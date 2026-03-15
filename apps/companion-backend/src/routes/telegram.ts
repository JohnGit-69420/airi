import type { createTelegramRuntime } from '../modules/messaging/telegram'
import type { startTelegramRunner } from '../modules/messaging/telegram-runner'

import { Hono } from 'hono'
import { integer, maxValue, minValue, number, object, optional, parse, pipe, string } from 'valibot'

import { forbiddenForMissingScope, hasScope } from '../modules/permissions/scopes'

const TELEGRAM_STATE_SCOPE = 'telegram:read'
const TELEGRAM_POLL_SCOPE = 'telegram:poll'
const TELEGRAM_SEND_SCOPE = 'telegram:send'
const TELEGRAM_SEND_VOICE_SCOPE = 'telegram:send:voice'
const TELEGRAM_RETRY_SCOPE = 'telegram:retry'

const SendTelegramSchema = object({
  text: string(),
  chatId: optional(string()),
  voiceUrl: optional(string()),
})

const RetryTelegramSchema = object({
  limit: optional(pipe(number(), integer(), minValue(1), maxValue(200)), 20),
})

const RecentDeliveriesSchema = object({
  limit: optional(pipe(number(), integer(), minValue(1), maxValue(200)), 20),
})

interface TelegramRunner {
  pollOnce: ReturnType<typeof startTelegramRunner>['pollOnce']
  retryOnce: ReturnType<typeof startTelegramRunner>['retryOnce']
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

    .get('/deliveries/recent', async (c) => {
      if (!hasScope(c, TELEGRAM_STATE_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_STATE_SCOPE)

      const rawLimit = c.req.query('limit')
      const input = {
        limit: rawLimit ? Number.parseInt(rawLimit, 10) : undefined,
      }
      const query = parse(RecentDeliveriesSchema, input)

      return c.json({ deliveries: await telegramRuntime.listRecentDeliveries(query.limit) })
    })

    .post('/poll', async (c) => {
      if (!hasScope(c, TELEGRAM_POLL_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_POLL_SCOPE)

      return c.json(await telegramRunner.pollOnce())
    })

    .post('/retry-failed', async (c) => {
      if (!hasScope(c, TELEGRAM_RETRY_SCOPE))
        return forbiddenForMissingScope(c, TELEGRAM_RETRY_SCOPE)

      let input: unknown = {}
      try {
        input = await c.req.json()
      }
      catch {
        // NOTICE: Empty body is valid and defaults retry limit.
      }

      const body = parse(RetryTelegramSchema, input)
      return c.json(await telegramRunner.retryOnce(body.limit))
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
