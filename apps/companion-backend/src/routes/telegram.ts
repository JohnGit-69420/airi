import type { createTelegramRuntime } from '../modules/messaging/telegram'
import type { startTelegramRunner } from '../modules/messaging/telegram-runner'

import { Hono } from 'hono'
import { object, optional, parse, string } from 'valibot'

const SendTelegramSchema = object({
  text: string(),
  chatId: optional(string()),
  voiceUrl: optional(string()),
})

interface TelegramRunner {
  pollOnce: ReturnType<typeof startTelegramRunner>['pollOnce']
}

/**
 * Creates Telegram routes for send/poll/state operations.
 */
export function createTelegramRoutes(
  telegramRuntime: ReturnType<typeof createTelegramRuntime>,
  telegramRunner: TelegramRunner,
) {
  return new Hono()
    .get('/state', async c => c.json({ state: await telegramRuntime.getState() }))

    .post('/poll', async c => c.json(await telegramRunner.pollOnce()))

    .post('/send', async (c) => {
      const input = await c.req.json()
      const body = parse(SendTelegramSchema, input)
      const result = await telegramRuntime.sendOutbound(body)
      return c.json(result)
    })
}
