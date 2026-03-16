import type { ChatRole } from './store'

import type { createChatStore } from './store'
import type { MemoryStoreContract } from '../memory/store'

interface ChatRuntimeOptions {
  sessionMaxMessages: number
}

/**
 * Creates chat runtime service that coordinates persistence, memory compaction, and session rollover.
 */
export function createChatRuntime(
  chatStore: ReturnType<typeof createChatStore>,
  memoryStore: MemoryStoreContract,
  options: ChatRuntimeOptions,
) {
  function buildRecoveredMemoryPrompt(memories: Array<{ summary: string }>) {
    const normalized = memories
      .map(memory => memory.summary.replaceAll(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 3)

    if (normalized.length === 0)
      return ''

    return [
      'Long-term memory highlights (use naturally only when relevant):',
      ...normalized.map((summary, index) => `${index + 1}. ${summary}`),
    ].join('\n')
  }

  return {
    async createSession(input: { clientId: string, clientType: 'desktop' | 'web' | 'mobile' | 'other', parentSessionId?: string }) {
      return chatStore.createSession(input)
    },

    async addMessage(input: { sessionId: string, role: ChatRole, content: string, clientMessageId?: string }) {
      const message = await chatStore.addMessage(input)
      const messages = await chatStore.getMessagesBySession(input.sessionId)

      let rolledOverSessionId: string | null = null

      if (messages.length >= options.sessionMaxMessages) {
        await memoryStore.compactSessionToMemory(input.sessionId, messages)

        const session = await chatStore.getSession(input.sessionId)
        if (!session)
          throw new Error(`Session not found: ${input.sessionId}`)

        const nextSession = await chatStore.createSession({
          clientId: session.clientId,
          clientType: session.clientType,
          parentSessionId: input.sessionId,
        })

        const memories = await memoryStore.getRecentMemories(2)
        const recoveredPrompt = buildRecoveredMemoryPrompt(memories)
        if (recoveredPrompt) {
          await chatStore.addMessage({
            sessionId: nextSession.id,
            role: 'system',
            content: recoveredPrompt,
          })
        }

        rolledOverSessionId = nextSession.id
      }

      return {
        message,
        rolledOverSessionId,
      }
    },

    async getSessionDetails(sessionId: string) {
      const session = await chatStore.getSession(sessionId)
      if (!session)
        return null

      const messages = await chatStore.getMessagesBySession(sessionId)

      return {
        session,
        messages,
      }
    },

    async getRecentMemories(limit = 3) {
      return memoryStore.getRecentMemories(limit)
    },

    async searchMemories(input: { query: string, limit?: number, sessionId?: string }) {
      return memoryStore.searchMemories(input.query, input.limit ?? 3, input.sessionId)
    },

    async rememberMessage(input: { sessionId: string, role: ChatRole, content: string }) {
      return memoryStore.rememberMessage(input.sessionId, input.role, input.content)
    },
  }
}
