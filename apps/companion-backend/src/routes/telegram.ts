import type { createTelegramRuntime } from '../modules/messaging/telegram'
import type { startTelegramRunner } from '../modules/messaging/telegram-runner'

import { Hono } from 'hono'
import { object, optional, parse, string } from 'valibot'

import { forbiddenForMissingScope, hasScope } from '../modules/permissions/scopes'

const TELEGRAM_STATE_SCOPE = 'telegram:read'
const TELEGRAM_POLL_SCOPE = 'telegram:poll'
const TELEGRAM_SEND_SCOPE = 'telegram:send'
const TELEGRAM_SEND_VOICE_SCOPE = 'telegram:send:voice'

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
    .get('/state', async (c) => {
      if (!hasScope(c, TELEGRAM_STATE_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_STATE_SCOPE)

      return c.json({ state: await telegramRuntime.getState() })
    })

    .post('/poll', async (c) => {
      if (!hasScope(c, TELEGRAM_POLL_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_POLL_SCOPE)

      return c.json(await telegramRunner.pollOnce())
    })

    .post('/send', async (c) => {
      if (!hasScope(c, TELEGRAM_SEND_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_SEND_SCOPE)

      const input = await c.req.json()
      const body = parse(SendTelegramSchema, input)

      if (body.voiceUrl && !hasScope(c, TELEGRAM_SEND_VOICE_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_SEND_VOICE_SCOPE)

      const result = await telegramRuntime.sendOutbound(body)
      return c.json(result)
    })
}
