import type { createChatRuntime } from '../modules/chat/service'

import { Hono } from 'hono'
import { object, parse, picklist, string } from 'valibot'

const CreateSessionSchema = object({
  clientId: string(),
  clientType: picklist(['desktop', 'web', 'mobile', 'other']),
})

/**
 * Creates session routes used by AIRI clients to establish backend sessions.
 */
export function createSessionRoutes(chatRuntime: ReturnType<typeof createChatRuntime>) {
  return new Hono()
    .post('/create', async (c) => {
      const input = await c.req.json()
      const body = parse(CreateSessionSchema, input)
      const session = await chatRuntime.createSession(body)

      return c.json({
        sessionId: session.id,
        issuedAt: session.createdAt,
        client: {
          clientId: session.clientId,
          clientType: session.clientType,
        },
      })
    })
}
