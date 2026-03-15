import { Hono } from 'hono'
import { object, parse, picklist, string } from 'valibot'

const CreateSessionSchema = object({
  clientId: string(),
  clientType: picklist(['desktop', 'web', 'mobile', 'other']),
})

/**
 * Creates session routes used by AIRI clients to establish backend sessions.
 */
export function createSessionRoutes() {
  return new Hono()
    .post('/create', async (c) => {
      const input = await c.req.json()
      const body = parse(CreateSessionSchema, input)

      return c.json({
        sessionId: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        client: body,
      })
    })
}
