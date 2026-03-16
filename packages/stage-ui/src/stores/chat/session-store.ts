import type { ChatHistoryItem } from '../../types/chat'
import type { ChatSessionMeta, ChatSessionRecord, ChatSessionsExport, ChatSessionsIndex } from '../../types/chat-session'

import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { client } from '../../composables/api'
import { appendCompanionMessage, createCompanionSession, getCompanionSessionDetails, isCompanionSyncEnabled } from '../../composables/companion-api'
import { useLocalFirstRequest } from '../../composables/use-local-first'
import { chatSessionsRepo } from '../../database/repos/chat-sessions.repo'
import { useAuthStore } from '../auth'
import { useAiriCardStore } from '../modules/airi-card'
import { mergeLoadedSessionMessages } from './session-message-merge'

export const useChatSessionStore = defineStore('chat-session', () => {
  const { userId, isAuthenticated } = storeToRefs(useAuthStore())
  const { activeCardId, systemPrompt } = storeToRefs(useAiriCardStore())

  const activeSessionId = ref<string>('')
  const sessionMessages = ref<Record<string, ChatHistoryItem[]>>({})
  const sessionMetas = ref<Record<string, ChatSessionMeta>>({})
  const sessionGenerations = ref<Record<string, number>>({})
  const index = ref<ChatSessionsIndex | null>(null)

  const ready = ref(false)
  const isReady = computed(() => ready.value)
  const initializing = ref(false)
  let initializePromise: Promise<void> | null = null

  let persistQueue = Promise.resolve()
  let syncQueue = Promise.resolve()
  const loadedSessions = new Set<string>()
  const companionSyncedMessageIds = ref<Record<string, Record<string, true>>>({})
  const companionSyncedMessageKeyCounts = ref<Record<string, Record<string, number>>>({})
  const loadingSessions = new Map<string, Promise<void>>()
  let lifecycleSyncBound = false

  // I know this nu uh, better than loading all language on rehypeShiki
  const codeBlockSystemPrompt = '- For any programming code block, always specify the programming language that supported on @shikijs/rehype on the rendered markdown, eg. ```python ... ```\n'
  const mathSyntaxSystemPrompt = '- For any math equation, use LaTeX format, eg: $ x^3 $, always escape dollar sign outside math equation\n'

  function getCurrentUserId() {
    return userId.value || 'local'
  }

  function getCurrentCharacterId() {
    return activeCardId.value || 'default'
  }

  function enqueuePersist(task: () => Promise<void>) {
    persistQueue = persistQueue.then(task, task)
    return persistQueue
  }

  function enqueueSync(task: () => Promise<void>) {
    syncQueue = syncQueue.then(task, task)
    return syncQueue
  }

  function snapshotMessages(messages: ChatHistoryItem[]) {
    return JSON.parse(JSON.stringify(messages)) as ChatHistoryItem[]
  }

  function extractMessageContent(message: ChatHistoryItem) {
    if (typeof message.content === 'string')
      return message.content
    if (Array.isArray(message.content)) {
      return message.content.map((part) => {
        if (typeof part === 'string')
          return part
        if (part && typeof part === 'object' && 'text' in part)
          return String(part.text ?? '')
        return ''
      }).join('')
    }
    return ''
  }

  function ensureSessionMessageIds(sessionId: string) {
    const current = sessionMessages.value[sessionId] ?? []
    let changed = false
    const next = current.map((message) => {
      if (message.id)
        return message
      changed = true
      return {
        ...message,
        id: nanoid(),
      }
    })

    if (changed)
      sessionMessages.value[sessionId] = next

    return next
  }

  function buildSyncMessages(messages: ChatHistoryItem[]) {
    return messages.map(message => ({
      id: message.id ?? nanoid(),
      role: message.role,
      content: extractMessageContent(message),
      createdAt: message.createdAt,
    }))
  }

  function buildCompanionMessageKey(role: 'system' | 'user' | 'assistant', content: string) {
    return `${role}\u001F${content}`
  }

  async function mergeCompanionMessagesIntoSession(sessionId: string, remoteMessages: Array<{ clientMessageId?: string, role: 'system' | 'user' | 'assistant', content: string }>) {
    if (remoteMessages.length === 0)
      return

    const localMessages = ensureSessionMessageIds(sessionId)
    const localById = new Set(localMessages.map(message => message.id).filter((id): id is string => Boolean(id)))
    const localKeyCounts: Record<string, number> = {}

    for (const localMessage of localMessages) {
      if (localMessage.role !== 'system' && localMessage.role !== 'user' && localMessage.role !== 'assistant')
        continue
      const content = extractMessageContent(localMessage).trim()
      if (!content)
        continue
      const key = buildCompanionMessageKey(localMessage.role, content)
      localKeyCounts[key] = (localKeyCounts[key] ?? 0) + 1
    }

    const remoteSeenKeyCounts: Record<string, number> = {}
    const messagesToAppend: ChatHistoryItem[] = []

    for (const remoteMessage of remoteMessages) {
      const content = remoteMessage.content.trim()
      if (!content)
        continue

      if (remoteMessage.clientMessageId && localById.has(remoteMessage.clientMessageId))
        continue

      const key = buildCompanionMessageKey(remoteMessage.role, content)
      remoteSeenKeyCounts[key] = (remoteSeenKeyCounts[key] ?? 0) + 1
      if (remoteSeenKeyCounts[key] <= (localKeyCounts[key] ?? 0))
        continue

      const id = remoteMessage.clientMessageId ?? nanoid()
      localById.add(id)
      localKeyCounts[key] = (localKeyCounts[key] ?? 0) + 1
      messagesToAppend.push({
        id,
        role: remoteMessage.role,
        content,
        createdAt: Date.now(),
      })
    }

    if (messagesToAppend.length === 0)
      return

    sessionMessages.value[sessionId] = [...localMessages, ...messagesToAppend]
    await persistSession(sessionId)
  }

  async function syncSessionToRemote(sessionId: string) {
    let cachedRecord: ChatSessionRecord | null | undefined
    const request = useLocalFirstRequest({
      local: async () => {
        cachedRecord = await chatSessionsRepo.getSession(sessionId)
        return cachedRecord
      },
      remote: async () => {
        if (!cachedRecord)
          cachedRecord = await chatSessionsRepo.getSession(sessionId)
        if (!cachedRecord)
          return cachedRecord

        const members: Array<
          | { type: 'user', userId: string }
          | { type: 'character', characterId: string }
        > = [
          { type: 'user', userId: userId.value },
        ]

        if (cachedRecord.meta.characterId && cachedRecord.meta.characterId !== 'default') {
          members.push({
            type: 'character',
            characterId: cachedRecord.meta.characterId,
          })
        }

        const normalizedMessages = cachedRecord.messages.map(message => message.id ? message : { ...message, id: nanoid() })
        if (normalizedMessages.some((message, index) => cachedRecord?.messages[index]?.id !== message.id)) {
          cachedRecord = {
            ...cachedRecord,
            messages: normalizedMessages,
          }
          await chatSessionsRepo.saveSession(sessionId, cachedRecord)
        }

        const res = await client.api.chats.sync.$post({
          json: {
            chat: {
              id: cachedRecord.meta.sessionId,
              type: 'group',
              title: cachedRecord.meta.title,
              createdAt: cachedRecord.meta.createdAt,
              updatedAt: cachedRecord.meta.updatedAt,
            },
            members,
            messages: buildSyncMessages(cachedRecord.messages),
          },
        })

        if (!res.ok)
          throw new Error('Failed to sync chat session')
        return cachedRecord
      },
      allowRemote: () => isAuthenticated.value,
      lazy: true,
    })

    await request.execute()
  }

  function scheduleSync(sessionId: string) {
    void enqueueSync(async () => {
      try {
        await syncSessionToRemote(sessionId)
      }
      catch (error) {
        console.warn('Failed to sync chat session', error)
      }

      try {
        await syncSessionToCompanion(sessionId)
      }
      catch (error) {
        console.warn('Failed to sync companion chat session', error)
      }
    })
  }


  function resolveCompanionClientType(): 'desktop' | 'web' | 'mobile' | 'other' {
    if (typeof navigator === 'undefined')
      return 'other'

    if (navigator.userAgent.includes('Electron'))
      return 'desktop'

    return 'web'
  }

  async function ensureCompanionSession(sessionId: string) {
    const meta = sessionMetas.value[sessionId]
    if (!meta)
      return null

    if (meta.companionSessionId)
      return meta.companionSessionId

    const companionSessionId = await createCompanionSession({
      clientId: `${meta.userId}:${meta.characterId}`,
      clientType: resolveCompanionClientType(),
    })

    const nextMeta = {
      ...meta,
      companionSessionId,
    }

    sessionMetas.value[sessionId] = nextMeta
    const characterIndex = index.value?.characters[meta.characterId]
    if (characterIndex)
      characterIndex.sessions[sessionId] = nextMeta

    const messages = snapshotMessages(ensureSessionMessageIds(sessionId))
    const record: ChatSessionRecord = {
      meta: nextMeta,
      messages,
    }

    await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    await persistIndex()
    return companionSessionId
  }

  async function syncSessionToCompanion(sessionId: string) {
    if (!isCompanionSyncEnabled())
      return

    const messages = ensureSessionMessageIds(sessionId)
    if (messages.length === 0)
      return

    const companionSessionId = await ensureCompanionSession(sessionId)
    if (!companionSessionId)
      return

    const details = await getCompanionSessionDetails(companionSessionId)
    await mergeCompanionMessagesIntoSession(sessionId, details.messages)

    let syncedIds = companionSyncedMessageIds.value[sessionId]
    if (!syncedIds) {
      syncedIds = {}
      for (const message of details.messages) {
        if (message.clientMessageId)
          syncedIds[message.clientMessageId] = true
      }
      companionSyncedMessageIds.value[sessionId] = syncedIds
    }

    let syncedKeyCounts = companionSyncedMessageKeyCounts.value[sessionId]
    if (!syncedKeyCounts) {
      syncedKeyCounts = {}
      for (const message of details.messages) {
        const content = message.content.trim()
        if (!content)
          continue
        const key = buildCompanionMessageKey(message.role, content)
        syncedKeyCounts[key] = (syncedKeyCounts[key] ?? 0) + 1
      }
      companionSyncedMessageKeyCounts.value[sessionId] = syncedKeyCounts
    }

    const localSeenKeyCounts: Record<string, number> = {}

    for (const message of messages) {
      const content = extractMessageContent(message).trim()
      if (!content)
        continue

      if (message.role !== 'system' && message.role !== 'user' && message.role !== 'assistant')
        continue

      if (message.id && syncedIds[message.id])
        continue

      const key = buildCompanionMessageKey(message.role, content)
      localSeenKeyCounts[key] = (localSeenKeyCounts[key] ?? 0) + 1
      const syncedCountForKey = syncedKeyCounts[key] ?? 0

      if (localSeenKeyCounts[key] <= syncedCountForKey)
        continue

      await appendCompanionMessage({
        sessionId: companionSessionId,
        role: message.role,
        content,
        clientMessageId: message.id,
      })

      if (message.id)
        syncedIds[message.id] = true

      syncedKeyCounts[key] = syncedCountForKey + 1
    }

    companionSyncedMessageIds.value[sessionId] = syncedIds
    companionSyncedMessageKeyCounts.value[sessionId] = syncedKeyCounts
  }


  async function flushPersistAndSyncQueues() {
    await persistQueue
    await syncQueue
  }

  function getKnownSessionIds() {
    return Array.from(new Set([
      ...Object.keys(sessionMetas.value),
      ...Object.keys(sessionMessages.value),
    ]))
  }

  async function syncAllKnownSessions() {
    const sessionIds = getKnownSessionIds()
    for (const sessionId of sessionIds)
      scheduleSync(sessionId)

    await flushPersistAndSyncQueues()
  }

  function bindLifecycleSync() {
    if (lifecycleSyncBound)
      return

    if (typeof window === 'undefined' || typeof document === 'undefined')
      return

    const flushOnLifecycle = () => {
      void syncAllKnownSessions()
    }

    window.addEventListener('beforeunload', flushOnLifecycle)
    window.addEventListener('pagehide', flushOnLifecycle)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden')
        flushOnLifecycle()
    })

    lifecycleSyncBound = true
  }

  function generateInitialMessageFromPrompt(prompt: string) {
    const content = codeBlockSystemPrompt + mathSyntaxSystemPrompt + prompt

    return {
      role: 'system',
      content,
      id: nanoid(),
      createdAt: Date.now(),
    } satisfies ChatHistoryItem
  }

  function generateInitialMessage() {
    return generateInitialMessageFromPrompt(systemPrompt.value)
  }

  function ensureGeneration(sessionId: string) {
    if (sessionGenerations.value[sessionId] === undefined)
      sessionGenerations.value[sessionId] = 0
  }

  async function loadIndexForUser(currentUserId: string) {
    const stored = await chatSessionsRepo.getIndex(currentUserId)
    index.value = stored ?? {
      userId: currentUserId,
      characters: {},
    }
  }

  function getCharacterIndex(characterId: string) {
    if (!index.value)
      return null
    return index.value.characters[characterId] ?? null
  }

  async function persistIndex() {
    if (!index.value)
      return
    const snapshot = JSON.parse(JSON.stringify(index.value)) as ChatSessionsIndex
    await enqueuePersist(() => chatSessionsRepo.saveIndex(snapshot))
  }

  async function persistSession(sessionId: string) {
    const meta = sessionMetas.value[sessionId]
    if (!meta)
      return
    const messages = snapshotMessages(ensureSessionMessageIds(sessionId))
    const now = Date.now()
    const updatedMeta = {
      ...meta,
      updatedAt: now,
    }

    sessionMetas.value[sessionId] = updatedMeta
    const characterIndex = index.value?.characters[meta.characterId]
    if (characterIndex)
      characterIndex.sessions[sessionId] = updatedMeta

    const record: ChatSessionRecord = {
      meta: updatedMeta,
      messages,
    }

    await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    await persistIndex()
    scheduleSync(sessionId)
  }

  function persistSessionMessages(sessionId: string) {
    void persistSession(sessionId)
  }

  function setSessionMessages(sessionId: string, next: ChatHistoryItem[]) {
    sessionMessages.value[sessionId] = next
    void persistSession(sessionId)
  }

  async function loadSession(sessionId: string) {
    if (loadedSessions.has(sessionId))
      return
    if (loadingSessions.has(sessionId)) {
      await loadingSessions.get(sessionId)
      return
    }

    const loadPromise = (async () => {
      const stored = await chatSessionsRepo.getSession(sessionId)
      if (stored) {
        const currentMessages = sessionMessages.value[sessionId] ?? []
        const mergedMessages = mergeLoadedSessionMessages(stored.messages, currentMessages)

        sessionMetas.value[sessionId] = stored.meta
        sessionMessages.value[sessionId] = mergedMessages
        ensureGeneration(sessionId)

        if (mergedMessages !== stored.messages)
          await persistSession(sessionId)
      }
      loadedSessions.add(sessionId)
    })()

    loadingSessions.set(sessionId, loadPromise)
    await loadPromise
    loadingSessions.delete(sessionId)
  }

  async function createSession(characterId: string, options?: { setActive?: boolean, messages?: ChatHistoryItem[], title?: string }) {
    const currentUserId = getCurrentUserId()
    const sessionId = nanoid()
    const now = Date.now()
    const meta: ChatSessionMeta = {
      sessionId,
      userId: currentUserId,
      characterId,
      title: options?.title,
      createdAt: now,
      updatedAt: now,
    }

    const initialMessages = options?.messages?.length ? options.messages : [generateInitialMessage()]

    sessionMetas.value[sessionId] = meta
    sessionMessages.value[sessionId] = initialMessages
    ensureGeneration(sessionId)

    if (!index.value)
      index.value = { userId: currentUserId, characters: {} }

    const characterIndex = index.value.characters[characterId] ?? {
      activeSessionId: sessionId,
      sessions: {},
    }
    characterIndex.sessions[sessionId] = meta
    if (options?.setActive !== false)
      characterIndex.activeSessionId = sessionId
    index.value.characters[characterId] = characterIndex

    const record: ChatSessionRecord = { meta, messages: initialMessages }
    await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    await persistIndex()
    scheduleSync(sessionId)

    if (options?.setActive !== false)
      activeSessionId.value = sessionId

    return sessionId
  }

  async function ensureActiveSessionForCharacter() {
    const currentUserId = getCurrentUserId()
    const characterId = getCurrentCharacterId()

    if (!index.value || index.value.userId !== currentUserId)
      await loadIndexForUser(currentUserId)

    const characterIndex = getCharacterIndex(characterId)
    if (!characterIndex) {
      await createSession(characterId)
      return
    }

    if (!characterIndex.activeSessionId) {
      await createSession(characterId)
      return
    }

    activeSessionId.value = characterIndex.activeSessionId
    await loadSession(characterIndex.activeSessionId)
    ensureSession(characterIndex.activeSessionId)
  }

  async function initialize() {
    if (ready.value)
      return
    if (initializePromise)
      return initializePromise
    initializing.value = true
    initializePromise = (async () => {
      await ensureActiveSessionForCharacter()
      bindLifecycleSync()
      await syncAllKnownSessions()
      ready.value = true
    })()

    try {
      await initializePromise
    }
    finally {
      initializePromise = null
      initializing.value = false
    }
  }

  function ensureSession(sessionId: string) {
    ensureGeneration(sessionId)
    if (!sessionMessages.value[sessionId] || sessionMessages.value[sessionId].length === 0) {
      sessionMessages.value[sessionId] = [generateInitialMessage()]
      void persistSession(sessionId)
    }
  }

  const messages = computed<ChatHistoryItem[]>({
    get: () => {
      if (!activeSessionId.value)
        return []
      ensureSession(activeSessionId.value)
      if (ready.value)
        void loadSession(activeSessionId.value)
      return sessionMessages.value[activeSessionId.value] ?? []
    },
    set: (value) => {
      if (!activeSessionId.value)
        return
      sessionMessages.value[activeSessionId.value] = value
      void persistSession(activeSessionId.value)
    },
  })

  function setActiveSession(sessionId: string) {
    activeSessionId.value = sessionId
    ensureSession(sessionId)

    const characterId = getCurrentCharacterId()
    const characterIndex = index.value?.characters[characterId]
    if (characterIndex) {
      characterIndex.activeSessionId = sessionId
      void persistIndex()
    }

    if (ready.value)
      void loadSession(sessionId)
  }

  function cleanupMessages(sessionId = activeSessionId.value) {
    ensureGeneration(sessionId)
    sessionGenerations.value[sessionId] += 1
    setSessionMessages(sessionId, [generateInitialMessage()])
  }

  function getAllSessions() {
    return JSON.parse(JSON.stringify(sessionMessages.value)) as Record<string, ChatHistoryItem[]>
  }

  async function resetAllSessions() {
    const currentUserId = getCurrentUserId()
    const characterId = getCurrentCharacterId()
    const sessionIds = new Set<string>()

    if (index.value?.userId === currentUserId) {
      for (const character of Object.values(index.value.characters)) {
        for (const sessionId of Object.keys(character.sessions))
          sessionIds.add(sessionId)
      }
    }

    for (const sessionId of sessionIds)
      await enqueuePersist(() => chatSessionsRepo.deleteSession(sessionId))

    sessionMessages.value = {}
    sessionMetas.value = {}
    sessionGenerations.value = {}
    companionSyncedMessageIds.value = {}
    companionSyncedMessageKeyCounts.value = {}
    loadedSessions.clear()
    loadingSessions.clear()

    index.value = {
      userId: currentUserId,
      characters: {},
    }

    await createSession(characterId)
  }

  function getSessionMessages(sessionId: string) {
    ensureSession(sessionId)
    if (ready.value)
      void loadSession(sessionId)
    return sessionMessages.value[sessionId] ?? []
  }

  function getSessionGeneration(sessionId: string) {
    ensureGeneration(sessionId)
    return sessionGenerations.value[sessionId] ?? 0
  }

  function bumpSessionGeneration(sessionId: string) {
    ensureGeneration(sessionId)
    sessionGenerations.value[sessionId] += 1
    return sessionGenerations.value[sessionId]
  }

  function getSessionGenerationValue(sessionId?: string) {
    const target = sessionId ?? activeSessionId.value
    return getSessionGeneration(target)
  }

  async function forkSession(options: { fromSessionId: string, atIndex?: number, reason?: string, hidden?: boolean }) {
    const characterId = getCurrentCharacterId()
    const parentMessages = getSessionMessages(options.fromSessionId)
    const forkIndex = options.atIndex ?? parentMessages.length
    const nextMessages = parentMessages.slice(0, forkIndex)
    return await createSession(characterId, { setActive: false, messages: nextMessages })
  }

  async function exportSessions(): Promise<ChatSessionsExport> {
    if (!ready.value)
      await initialize()

    if (!index.value) {
      return {
        format: 'chat-sessions-index:v1',
        index: { userId: getCurrentUserId(), characters: {} },
        sessions: {},
      }
    }

    const sessions: Record<string, ChatSessionRecord> = {}
    for (const character of Object.values(index.value.characters)) {
      for (const sessionId of Object.keys(character.sessions)) {
        const stored = await chatSessionsRepo.getSession(sessionId)
        if (stored) {
          sessions[sessionId] = stored
          continue
        }
        const meta = sessionMetas.value[sessionId]
        const messages = sessionMessages.value[sessionId]
        if (meta && messages)
          sessions[sessionId] = { meta, messages }
      }
    }

    return {
      format: 'chat-sessions-index:v1',
      index: index.value,
      sessions,
    }
  }

  async function importSessions(payload: ChatSessionsExport) {
    if (payload.format !== 'chat-sessions-index:v1')
      return

    index.value = payload.index
    sessionMessages.value = {}
    sessionMetas.value = {}
    sessionGenerations.value = {}
    companionSyncedMessageIds.value = {}
    companionSyncedMessageKeyCounts.value = {}
    loadedSessions.clear()
    loadingSessions.clear()

    await enqueuePersist(() => chatSessionsRepo.saveIndex(payload.index))

    for (const [sessionId, record] of Object.entries(payload.sessions)) {
      sessionMetas.value[sessionId] = record.meta
      sessionMessages.value[sessionId] = record.messages
      ensureGeneration(sessionId)
      await enqueuePersist(() => chatSessionsRepo.saveSession(sessionId, record))
    }

    await ensureActiveSessionForCharacter()
  }

  watch([userId, activeCardId], () => {
    if (!ready.value)
      return
    void ensureActiveSessionForCharacter()
  })

  return {
    ready,
    isReady,
    initialize,

    activeSessionId,
    messages,

    setActiveSession,
    cleanupMessages,
    getAllSessions,
    resetAllSessions,

    ensureSession,
    setSessionMessages,
    persistSessionMessages,
    getSessionMessages,
    sessionMessages,
    sessionMetas,
    getSessionGeneration,
    bumpSessionGeneration,
    getSessionGenerationValue,

    forkSession,
    exportSessions,
    importSessions,
  }
})
