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

async function assertMem0Ok(response: Response, operation: string) {
  if (response.ok)
    return

  const body = await response.text()
  throw new Error(`Mem0 ${operation} failed (${response.status}): ${body.slice(0, 300)}`)
}

function resolveAppId(config: Mem0ClientConfig, appId?: string) {
  return appId || config.appId || undefined
}

function resolveUserId(sessionId?: string) {
  return sessionId || undefined
}

function buildSearchFilters(userId: string | undefined, appId: string | undefined) {
  const conditions: Array<Record<string, string>> = []

  if (userId)
    conditions.push({ user_id: userId })

  if (appId)
    conditions.push({ app_id: appId })

  if (conditions.length === 0)
    return undefined

  return { OR: conditions }
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
      const userId = resolveUserId(sessionId)
      const appId = resolveAppId(config)
      const response = await fetch(`${endpoint}/v1/memories/`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify({
          messages: [{ role: 'assistant', content: summary } satisfies Mem0Message],
          user_id: userId,
          app_id: appId,
          version: 'v2',
        }),
      })

      await assertMem0Ok(response, 'compact')

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
      const response = await fetch(`${endpoint}/v2/memories/search/`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify({
          query: 'recent companion memories',
          filters: buildSearchFilters(undefined, appId),
          limit,
        }),
      })

      await assertMem0Ok(response, 'search')

      const raw = await response.json() as { memories?: Mem0SearchResult[] }
      const memories = Array.isArray(raw.memories) ? raw.memories : []

      return memories.slice(0, limit).map(memory => ({
        id: memory.id ?? crypto.randomUUID(),
        sourceSessionId: 'mem0',
        summary: memory.memory ?? '',
        createdAt: memory.created_at ?? new Date().toISOString(),
      }))
    },

    async searchMemories(query: string, limit = 3, sessionId?: string, appId?: string): Promise<MemoryEntry[]> {
      const resolvedAppId = resolveAppId(config, appId)
      const userId = resolveUserId(sessionId)
      const response = await fetch(`${endpoint}/v2/memories/search/`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify({
          query,
          limit,
          filters: buildSearchFilters(userId, resolvedAppId),
        }),
      })

      await assertMem0Ok(response, 'search')

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

      const resolvedAppId = resolveAppId(config, appId)
      const userId = resolveUserId(sessionId)
      const response = await fetch(`${endpoint}/v1/memories/`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify({
          messages: [{ role: 'user', content: summary } satisfies Mem0Message],
          user_id: userId,
          app_id: resolvedAppId,
          version: 'v2',
        }),
      })

      await assertMem0Ok(response, 'remember')

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
