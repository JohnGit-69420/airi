import type { ChatMessage } from '../chat/store'

import type { MemoryEntry } from './store'

export interface CompactSessionInput {
  sessionId: string
  messages: ChatMessage[]
}

export interface RetrieveRecentInput {
  limit: number
}

export interface MemoryProviderContract {
  compactSessionToMemory(input: CompactSessionInput): Promise<MemoryEntry>
  getRecentMemories(input: RetrieveRecentInput): Promise<MemoryEntry[]>
}

/**
 * Adapts the current local memory store to the provider contract used by chat runtime.
 */
export function createLocalMemoryProviderAdapter(localMemoryStore: {
  compactSessionToMemory: (sessionId: string, messages: ChatMessage[]) => Promise<MemoryEntry>
  getRecentMemories: (limit?: number) => Promise<MemoryEntry[]>
}): MemoryProviderContract {
  return {
    compactSessionToMemory: input => localMemoryStore.compactSessionToMemory(input.sessionId, input.messages),
    getRecentMemories: input => localMemoryStore.getRecentMemories(input.limit),
  }
}
