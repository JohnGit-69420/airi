import type { ChatMessage } from '../chat/store'

import type { MemoryEntry } from './store'

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
  orgId?: string
  projectId?: string
}

function buildMem0Headers(config: Mem0ClientConfig) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${config.apiKey}`)

  if (config.orgId)
    headers.set('x-mem0-org-id', config.orgId)

  if (config.projectId)
    headers.set('x-mem0-project-id', config.projectId)

  return headers
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
      const userId = `session:${sessionId}`
      const payload = {
        messages: [
          {
            role: 'assistant',
            content: summary,
          } satisfies Mem0Message,
        ],
        user_id: userId,
      }

      const response = await fetch(`${endpoint}/v1/memories`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify(payload),
      })

      if (!response.ok)
        throw new Error(`Mem0 compact failed (${response.status})`)

      const raw = await response.json() as { id?: string, created_at?: string }
      return {
        id: raw.id ?? crypto.randomUUID(),
        sourceSessionId: sessionId,
        summary,
        createdAt: raw.created_at ?? new Date().toISOString(),
      }
    },

    async getRecentMemories(limit = 3): Promise<MemoryEntry[]> {
      const response = await fetch(`${endpoint}/v1/memories/search`, {
        method: 'POST',
        headers: buildMem0Headers(config),
        body: JSON.stringify({ query: 'recent companion memories', limit }),
      })

      if (!response.ok)
        throw new Error(`Mem0 search failed (${response.status})`)

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
  }
}
