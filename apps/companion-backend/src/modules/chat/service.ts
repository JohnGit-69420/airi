import type { ChatRole } from './store'

import type { createChatStore } from './store'
import type { createMemoryStore } from '../memory/store'

interface ChatRuntimeOptions {
  sessionMaxMessages: number
}

/**
 * Creates chat runtime service that coordinates persistence, memory compaction, and session rollover.
 */
export function createChatRuntime(
  chatStore: ReturnType<typeof createChatStore>,
  memoryStore: ReturnType<typeof createMemoryStore>,
  options: ChatRuntimeOptions,
) {
  return {
    async createSession(input: { clientId: string, clientType: 'desktop' | 'web' | 'mobile' | 'other', parentSessionId?: string }) {
      return chatStore.createSession(input)
    },

    async addMessage(input: { sessionId: string, role: ChatRole, content: string }) {
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
        if (memories.length > 0) {
          await chatStore.addMessage({
            sessionId: nextSession.id,
            role: 'system',
            content: `Recovered memory context:\n${memories.map(entry => `- ${entry.summary}`).join('\n')}`,
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
  }
}
