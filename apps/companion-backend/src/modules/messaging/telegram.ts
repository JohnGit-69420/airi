import type { createChatRuntime } from '../chat/service'
import type { createTelegramStore } from './telegram-store'

export interface TelegramConfig {
  enabled: boolean
  botToken: string
  chatId: string
  inboundSessionId: string
  pollIntervalSeconds: number
  ttsEnabled: boolean
  retryEnabled: boolean
  maxRetries: number
  retryBackoffSeconds: number
}

interface TelegramUpdate {
  update_id: number
  message?: {
    text?: string
    chat?: {
      id?: number
    }
    from?: {
      id?: number
      username?: string
      first_name?: string
    }
  }
}

function buildTelegramUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

async function fetchUpdates(botToken: string, offset: number): Promise<TelegramUpdate[]> {
  const response = await fetch(buildTelegramUrl(botToken, 'getUpdates'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offset,
      timeout: 0,
      allowed_updates: ['message'],
    }),
  })

  if (!response.ok)
    throw new Error(`Telegram getUpdates failed: ${response.status}`)

  const payload = await response.json() as { ok?: boolean, result?: TelegramUpdate[] }
  if (!payload.ok)
    throw new Error('Telegram getUpdates returned non-ok response')

  return payload.result ?? []
}

async function sendTextMessage(botToken: string, chatId: string, text: string) {
  const response = await fetch(buildTelegramUrl(botToken, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  if (!response.ok)
    throw new Error(`Telegram sendMessage failed: ${response.status}`)
}

async function sendVoiceMessage(botToken: string, chatId: string, voiceUrl: string, caption?: string) {
  const response = await fetch(buildTelegramUrl(botToken, 'sendVoice'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      voice: voiceUrl,
      caption,
    }),
  })

  if (!response.ok)
    throw new Error(`Telegram sendVoice failed: ${response.status}`)
}

/**
 * Creates Telegram messaging runtime for inbound polling and outbound delivery.
 */
export function createTelegramRuntime(
  config: TelegramConfig,
  store: ReturnType<typeof createTelegramStore>,
  chatRuntime: ReturnType<typeof createChatRuntime>,
) {
  return {
    async pollInbound() {
      if (!config.enabled)
        return { status: 'disabled' as const, updates: 0, ingested: 0 }

      if (!config.botToken || !config.inboundSessionId)
        return { status: 'misconfigured' as const, updates: 0, ingested: 0 }

      const state = await store.getState()
      const updates = await fetchUpdates(config.botToken, state.lastUpdateId + 1)

      let maxUpdateId = state.lastUpdateId
      let ingested = 0

      for (const update of updates) {
        maxUpdateId = Math.max(maxUpdateId, update.update_id)

        const text = update.message?.text?.trim()
        const inboundChatId = update.message?.chat?.id?.toString()

        if (!text)
          continue

        if (config.chatId && inboundChatId !== config.chatId)
          continue

        await chatRuntime.addMessage({
          sessionId: config.inboundSessionId,
          role: 'user',
          content: text,
        })

        ingested += 1
      }

      if (maxUpdateId > state.lastUpdateId)
        await store.setLastUpdateId(maxUpdateId)

      return {
        status: 'ok' as const,
        updates: updates.length,
        ingested,
        lastUpdateId: maxUpdateId,
      }
    },

    async sendOutbound(input: { text: string, chatId?: string, voiceUrl?: string }) {
      if (!config.enabled)
        return { status: 'disabled' as const }

      const targetChatId = input.chatId ?? config.chatId
      if (!config.botToken || !targetChatId)
        return { status: 'misconfigured' as const }

      const delivery = await store.createDelivery({
        text: input.text,
        chatId: targetChatId,
        voiceUrl: input.voiceUrl,
        maxAttempts: Math.max(1, config.maxRetries),
      })

      try {
        await sendTextMessage(config.botToken, targetChatId, input.text)

        const shouldSendVoice = Boolean(config.ttsEnabled && input.voiceUrl)
        if (shouldSendVoice)
          await sendVoiceMessage(config.botToken, targetChatId, input.voiceUrl!, input.text)

        await store.markDeliverySent(delivery.id, shouldSendVoice, 'sent')

        return {
          status: 'sent' as const,
          chatId: targetChatId,
          ttsSent: shouldSendVoice,
          deliveryId: delivery.id,
        }
      }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown telegram send error.'
        const nextRetryAt = config.retryEnabled
          ? new Date(Date.now() + config.retryBackoffSeconds * 1000).toISOString()
          : undefined
        const updated = await store.markDeliveryFailed(delivery.id, message, nextRetryAt)

        return {
          status: config.retryEnabled ? 'retry_scheduled' as const : 'failed' as const,
          chatId: targetChatId,
          deliveryId: delivery.id,
          reason: message,
          nextRetryAt: updated?.nextRetryAt,
        }
      }
    },

    async retryFailedDeliveries(limit = 10) {
      if (!config.enabled)
        return { status: 'disabled' as const, processed: 0, sent: 0, failed: 0 }

      if (!config.retryEnabled)
        return { status: 'retry_disabled' as const, processed: 0, sent: 0, failed: 0 }

      if (!config.botToken)
        return { status: 'misconfigured' as const, processed: 0, sent: 0, failed: 0 }

      const nowIso = new Date().toISOString()
      const candidates = await store.listRetryCandidates(nowIso, limit)
      let sent = 0
      let failed = 0

      for (const delivery of candidates) {
        try {
          await sendTextMessage(config.botToken, delivery.chatId, delivery.text)

          const shouldSendVoice = Boolean(config.ttsEnabled && delivery.voiceUrl)
          if (shouldSendVoice)
            await sendVoiceMessage(config.botToken, delivery.chatId, delivery.voiceUrl!, delivery.text)

          await store.markDeliverySent(delivery.id, shouldSendVoice, 'retry_sent')
          sent += 1
        }
        catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown telegram retry error.'
          const nextRetryAt = new Date(Date.now() + config.retryBackoffSeconds * 1000).toISOString()
          await store.markDeliveryFailed(delivery.id, message, nextRetryAt)
          failed += 1
        }
      }

      return {
        status: 'ok' as const,
        processed: candidates.length,
        sent,
        failed,
      }
    },

    async getState() {
      return store.getState()
    },

    async listRecentDeliveries(limit = 20) {
      return store.listRecentDeliveries(limit)
    },
  }
}
