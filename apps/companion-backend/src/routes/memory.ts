import type { createChatRuntime } from '../modules/chat/service'

import { Hono } from 'hono'

/**
 * Creates memory routes for retrieving compacted summaries used as long-term context.
 */
export function createMemoryRoutes(chatRuntime: ReturnType<typeof createChatRuntime>) {
  return new Hono().get('/recent', async (c) => {
    const memories = await chatRuntime.getRecentMemories(5)
    return c.json({ memories })
  })
}
