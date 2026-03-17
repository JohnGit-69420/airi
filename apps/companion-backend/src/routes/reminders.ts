import type { createReminderRuntime } from '../modules/reminders/service'

import { Hono } from 'hono'
import { integer, maxValue, minValue, number, object, optional, parse, picklist, pipe, string } from 'valibot'

const CreateReminderSchema = object({
  sessionId: string(),
  message: string(),
  dueAt: string(),
  maxAttempts: optional(pipe(number(), integer(), minValue(1), maxValue(10)), 3),
})

const ListReminderQuerySchema = object({
  status: optional(picklist(['pending', 'delivered', 'failed', 'cancelled'])),
})

const ProcessDueSchema = object({
  limit: optional(pipe(number(), integer(), minValue(1), maxValue(200)), 20),
})

const ListDeliveriesQuerySchema = object({
  limit: optional(pipe(number(), integer(), minValue(1), maxValue(200)), 20),
})

function parseIsoDate(input: string): string {
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime()))
    throw new Error('dueAt must be a valid ISO timestamp')

  return parsed.toISOString()
}

/**
 * Creates reminder routes for scheduling and processing proactive reminder delivery.
 */
export function createReminderRoutes(reminderRuntime: ReturnType<typeof createReminderRuntime>) {
  return new Hono()
    .get('/', async (c) => {
      const query = parse(ListReminderQuerySchema, {
        status: c.req.query('status'),
      })

      const reminders = await reminderRuntime.listReminders(query.status)
      return c.json({ reminders })
    })

    .get('/deliveries/recent', async (c) => {
      const query = parse(ListDeliveriesQuerySchema, {
        limit: c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined,
      })

      const deliveries = await reminderRuntime.listRecentDeliveries(query.limit)
      return c.json({ deliveries })
    })

    .get('/:reminderId', async (c) => {
      const reminder = await reminderRuntime.getReminder(c.req.param('reminderId'))
      if (!reminder)
        return c.json({ error: 'not_found', message: 'Reminder not found.' }, 404)

      return c.json({ reminder })
    })

    .post('/', async (c) => {
      const input = await c.req.json()
      const body = parse(CreateReminderSchema, input)

      const reminder = await reminderRuntime.createReminder({
        sessionId: body.sessionId,
        message: body.message,
        dueAt: parseIsoDate(body.dueAt),
        maxAttempts: body.maxAttempts,
      })

      return c.json({ reminder }, 201)
    })

    .post('/process-due', async (c) => {
      let bodyInput: unknown = {}
      try {
        bodyInput = await c.req.json()
      }
      catch {
        // NOTICE: Empty body is valid and uses default processing limit.
      }

      const body = parse(ProcessDueSchema, bodyInput)
      const result = await reminderRuntime.processDueReminders(body.limit)
      return c.json(result)
    })
}
