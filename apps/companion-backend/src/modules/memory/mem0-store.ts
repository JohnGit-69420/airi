import type { ChatMessage } from '../chat/store'
import type { MemoryEntry, MemoryStoreContract } from './store'

interface Mem0Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface Mem0SearchResult {
  id?: string
  memory?: string
  score?: number
  created_at?: string
}

interface Mem0ClientConfig {
  baseUrl: string
  apiKey: string
  authScheme?: 'bearer' | 'token' | 'api-key'
  appId?: string
  orgId?: string
  projectId?: string
}

function buildMem0Headers(config: Mem0ClientConfig) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')

  if (config.authScheme === 'api-key') {
    headers.set('x-api-key', config.apiKey)
  }
  else {
    const authPrefix = config.authScheme === 'token' ? 'Token' : 'Bearer'
    headers.set('Authorization', `${authPrefix} ${config.apiKey}`)
    // NOTICE: Some mem0 deployments validate x-api-key rather than Authorization.
    headers.set('x-api-key', config.apiKey)
  }

  if (config.orgId)
    headers.set('x-mem0-org-id', config.orgId)

  if (config.projectId)
    headers.set('x-mem0-project-id', config.projectId)

  return headers
}

function buildMem0Filters(userId: string | undefined, appId: string | undefined) {
  const filters: Record<string, string> = {}

  if (appId)
    filters.app_id = appId

  if (userId)
    filters.user_id = userId

  return Object.keys(filters).length > 0 ? filters : undefined
}

function resolveUserIds(sessionId?: string) {
  if (!sessionId)
    return [undefined]

  // NOTICE: Some mem0 deployments only accept raw user_id while others are okay
  // with namespaced ids. We attempt both deterministically to improve portability.
  return [`session:${sessionId}`, sessionId]
}

function resolveAppId(config: Mem0ClientConfig, appId?: string) {
  return appId || config.appId || undefined
}

function isMem0MissingFilterError(body: string) {
  return body.includes('One of the filters: app_id, user_id, agent_id, run_id is required!')
}

async function postMem0WithFilterFallback(
  endpoint: string,
  config: Mem0ClientConfig,
  operation: string,
  buildBody: (userId: string | undefined, appId: string | undefined) => Record<string, unknown>,
  options?: { sessionId?: string, appId?: string },
): Promise<Response> {
  const resolvedAppId = resolveAppId(config, options?.appId)
  const userIds = resolveUserIds(options?.sessionId)

  let lastStatus = 0
  let lastBody = ''

  for (const userId of userIds) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildMem0Headers(config),
      body: JSON.stringify(buildBody(userId, resolvedAppId)),
    })

    if (response.ok)
      return response

    lastStatus = response.status
    lastBody = await response.text()

    if (!isMem0MissingFilterError(lastBody))
      break
  }

  throw new Error(`Mem0 ${operation} failed (${lastStatus}): ${lastBody.slice(0, 300)}`)
}


function buildMem0IdentityFields(userId: string | undefined, appId: string | undefined, sessionId?: string) {
  return {
    user_id: userId,
    userId: userId,
    app_id: appId,
    appId: appId,
    run_id: sessionId,
    runId: sessionId,
    agent_id: appId,
    agentId: appId,
  }
}

function summarizeMessages(messages: ChatMessage[]) {
  return messages
    .slice(-8)
    .map(message => `${message.role}: ${message.content}`)
    .join('\n')
    .slice(0, 2000)
}

/**
 * Creates a mem0-backed memory store for compaction + retrieval.
 */
export function createMem0MemoryStore(config: Mem0ClientConfig) {
  if (!config.baseUrl || !config.apiKey)
    throw new Error('MEMORY_PROVIDER=mem0 requires MEM0_BASE_URL and MEM0_API_KEY')

  const endpoint = config.baseUrl.replace(/\/$/, '')

  return {
    async compactSessionToMemory(sessionId: string, messages: ChatMessage[]): Promise<MemoryEntry> {
      const summary = summarizeMessages(messages)
      const response = await postMem0WithFilterFallback(
        `${endpoint}/v1/memories`,
        config,
        'compact',
        (userId, appId) => ({
          messages: [
            {
              role: 'assistant',
              content: summary,
            } satisfies Mem0Message,
          ],
          ...buildMem0IdentityFields(userId, appId, sessionId),
          filters: buildMem0Filters(userId, appId),
        }),
        { sessionId },
      )

      const raw = await response.json() as { id?: string, created_at?: string }
      return {
        id: raw.id ?? crypto.randomUUID(),
        sourceSessionId: sessionId,
        summary,
        createdAt: raw.created_at ?? new Date().toISOString(),
      }
    },

    async getRecentMemories(limit = 3): Promise<MemoryEntry[]> {
      const appId = resolveAppId(config)
      const response = await postMem0WithFilterFallback(
        `${endpoint}/v1/memories/search`,
        config,
        'search',
        () => ({
          query: 'recent companion memories',
          limit,
          ...buildMem0IdentityFields(undefined, appId),
          filters: buildMem0Filters(undefined, appId),
        }),
      )

      const raw = await response.json() as { memories?: Mem0SearchResult[] }
      const memories = Array.isArray(raw.memories) ? raw.memories : []

      return memories.slice(0, limit).map((memory) => {
        return {
          id: memory.id ?? crypto.randomUUID(),
          sourceSessionId: 'mem0',
          summary: memory.memory ?? '',
          createdAt: memory.created_at ?? new Date().toISOString(),
        }
      })
    },

    async searchMemories(query: string, limit = 3, sessionId?: string, appId?: string): Promise<MemoryEntry[]> {
      const response = await postMem0WithFilterFallback(
        `${endpoint}/v1/memories/search`,
        config,
        'search',
        (userId, resolvedAppId) => ({
          query,
          limit,
          ...buildMem0IdentityFields(userId, resolvedAppId, sessionId),
          filters: buildMem0Filters(userId, resolvedAppId),
        }),
        { sessionId, appId },
      )

      const raw = await response.json() as { memories?: Mem0SearchResult[] }
      const memories = Array.isArray(raw.memories) ? raw.memories : []

      return memories.slice(0, limit).map(memory => ({
        id: memory.id ?? crypto.randomUUID(),
        sourceSessionId: sessionId ?? 'mem0',
        summary: memory.memory ?? '',
        createdAt: memory.created_at ?? new Date().toISOString(),
      }))
    },

    async rememberMessage(sessionId: string, role: ChatMessage['role'], content: string, appId?: string): Promise<MemoryEntry | null> {
      if (role !== 'user')
        return null

      const summary = content.trim()
      if (!summary)
        return null

      const response = await postMem0WithFilterFallback(
        `${endpoint}/v1/memories`,
        config,
        'remember',
        (userId, resolvedAppId) => ({
          messages: [{ role: 'user', content: summary } satisfies Mem0Message],
          ...buildMem0IdentityFields(userId, resolvedAppId, sessionId),
          filters: buildMem0Filters(userId, resolvedAppId),
        }),
        { sessionId, appId },
      )

      const raw = await response.json() as { id?: string, created_at?: string }
      return {
        id: raw.id ?? crypto.randomUUID(),
        sourceSessionId: sessionId,
        summary,
        createdAt: raw.created_at ?? new Date().toISOString(),
      }
    },
  } satisfies MemoryStoreContract
}
