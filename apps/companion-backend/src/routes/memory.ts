import type { createChatRuntime } from '../modules/chat/service'

import { Hono } from 'hono'
import { minLength, number, object, optional, parse, picklist, pipe, string } from 'valibot'

const SearchMemoriesSchema = object({
  query: pipe(string(), minLength(1)),
  limit: optional(number()),
  sessionId: optional(string()),
})

const RememberMessageSchema = object({
  sessionId: pipe(string(), minLength(1)),
  role: picklist(['system', 'user', 'assistant']),
  content: pipe(string(), minLength(1)),
})

/**
 * Creates memory routes for retrieving compacted summaries used as long-term context.
 */
export function createMemoryRoutes(chatRuntime: ReturnType<typeof createChatRuntime>) {
  return new Hono()
    .get('/recent', async (c) => {
      const memories = await chatRuntime.getRecentMemories(5)
      return c.json({ memories })
    })
    .post('/search', async (c) => {
      try {
        const body = parse(SearchMemoriesSchema, await c.req.json())
        const memories = await chatRuntime.searchMemories({
          query: body.query,
          limit: body.limit,
          sessionId: body.sessionId,
        })
        return c.json({ memories })
      }
      catch (error) {
        return c.json({ error: 'memory_search_failed', message: String(error) }, 502)
      }
    })
    .post('/remember', async (c) => {
      try {
        const body = parse(RememberMessageSchema, await c.req.json())
        const memory = await chatRuntime.rememberMessage(body)
        return c.json({ memory, stored: Boolean(memory) })
      }
      catch (error) {
        return c.json({ error: 'memory_remember_failed', message: String(error) }, 502)
      }
    })
}
