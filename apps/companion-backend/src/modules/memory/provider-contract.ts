import type { ChatMessage } from '../chat/store'
import type { MemoryEntry } from './store'

export interface CompactSessionInput {
  sessionId: string
  messages: ChatMessage[]
}

export interface RetrieveRecentInput {
  limit: number
}

export interface SearchMemoryInput {
  query: string
  limit: number
  sessionId?: string
  appId?: string
}

export interface RememberMessageInput {
  sessionId: string
  role: ChatMessage['role']
  content: string
  appId?: string
}

export interface MemoryProviderContract {
  compactSessionToMemory: (input: CompactSessionInput) => Promise<MemoryEntry>
  getRecentMemories: (input: RetrieveRecentInput) => Promise<MemoryEntry[]>
  searchMemories: (input: SearchMemoryInput) => Promise<MemoryEntry[]>
  rememberMessage: (input: RememberMessageInput) => Promise<MemoryEntry | null>
}

/**
 * Adapts the current local memory store to the provider contract used by chat runtime.
 */
export function createLocalMemoryProviderAdapter(localMemoryStore: {
  compactSessionToMemory: (sessionId: string, messages: ChatMessage[]) => Promise<MemoryEntry>
  getRecentMemories: (limit?: number) => Promise<MemoryEntry[]>
  searchMemories: (query: string, limit?: number, sessionId?: string, appId?: string) => Promise<MemoryEntry[]>
  rememberMessage: (sessionId: string, role: ChatMessage['role'], content: string, appId?: string) => Promise<MemoryEntry | null>
}): MemoryProviderContract {
  return {
    compactSessionToMemory: input => localMemoryStore.compactSessionToMemory(input.sessionId, input.messages),
    getRecentMemories: input => localMemoryStore.getRecentMemories(input.limit),
    searchMemories: input => localMemoryStore.searchMemories(input.query, input.limit, input.sessionId, input.appId),
    rememberMessage: input => localMemoryStore.rememberMessage(input.sessionId, input.role, input.content, input.appId),
  }
}
