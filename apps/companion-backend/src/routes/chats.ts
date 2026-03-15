import type { createChatRuntime } from '../modules/chat/service'

import { Hono } from 'hono'
import { object, parse, picklist, string } from 'valibot'

const AddMessageSchema = object({
  role: picklist(['system', 'user', 'assistant']),
  content: string(),
})

/**
 * Creates chat routes for persistent message history and deterministic session rollover.
 */
export function createChatRoutes(chatRuntime: ReturnType<typeof createChatRuntime>) {
  return new Hono()
    .get('/:sessionId', async (c) => {
      const sessionId = c.req.param('sessionId')
      const details = await chatRuntime.getSessionDetails(sessionId)
      if (!details)
        return c.json({ error: 'not_found', message: 'Session not found.' }, 404)

      return c.json(details)
    })

    .post('/:sessionId/messages', async (c) => {
      const sessionId = c.req.param('sessionId')
      const input = await c.req.json()
      const body = parse(AddMessageSchema, input)

      try {
        const result = await chatRuntime.addMessage({
          sessionId,
          role: body.role,
          content: body.content,
        })

        return c.json(result)
      }
      catch {
        return c.json({ error: 'not_found', message: 'Session not found.' }, 404)
      }
    })
}
