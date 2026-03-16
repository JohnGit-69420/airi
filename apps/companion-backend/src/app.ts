import type { Env } from './libs/env'

import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { parsedEnv } from './libs/env'
import { createDeviceTokenAuthMiddleware, parseConfiguredDeviceTokens, parseDeviceTokenScopes } from './modules/auth/device-token'
import { createChatRuntime } from './modules/chat/service'
import { createChatStore } from './modules/chat/store'
import { startJellyfinAwarenessRunner } from './modules/integrations/jellyfin-awareness-runner'
import { createIntegrationRegistry } from './modules/integrations/registry'
import { createMemoryStore } from './modules/memory/store'
import { createTelegramRuntime } from './modules/messaging/telegram'
import { startTelegramRunner } from './modules/messaging/telegram-runner'
import { createTelegramStore } from './modules/messaging/telegram-store'
import { createReminderRuntime } from './modules/reminders/service'
import { createReminderStore } from './modules/reminders/store'
import { createChatRoutes } from './routes/chats'
import { createIntegrationRoutes } from './routes/integrations'
import { createJellyfinAwarenessRoutes } from './routes/jellyfin-awareness'
import { createMemoryRoutes } from './routes/memory'
import { createReminderRoutes } from './routes/reminders'
import { createSessionRoutes } from './routes/session'
import { createTelegramRoutes } from './routes/telegram'

interface AppDeps {
  deviceTokensRaw: string
  deviceTokenScopesRaw: string
  chatDataPath: string
  memoryDataPath: string
  remindersDataPath: string
  telegramDataPath: string
  sessionMaxMessages: number
  env: Env
}

/**
 * Builds the companion backend app with health and authenticated API routes.
 */
function buildApp({ deviceTokensRaw, deviceTokenScopesRaw, chatDataPath, memoryDataPath, remindersDataPath, telegramDataPath, sessionMaxMessages, env }: AppDeps) {
  const app = new Hono()
  const logger = useLogger('companion-backend').useGlobalConfig()

  const deviceTokens = parseConfiguredDeviceTokens(deviceTokensRaw)
  const deviceTokenScopes = parseDeviceTokenScopes(deviceTokenScopesRaw)
  const requireDeviceToken = createDeviceTokenAuthMiddleware(deviceTokens, deviceTokenScopes)

  const chatStore = createChatStore(chatDataPath)
  const memoryStore = createMemoryStore(memoryDataPath)
  const chatRuntime = createChatRuntime(chatStore, memoryStore, { sessionMaxMessages })
  const integrationRegistry = createIntegrationRegistry()
  const reminderStore = createReminderStore(remindersDataPath)
  const reminderRuntime = createReminderRuntime(reminderStore, chatRuntime)

  const telegramStore = createTelegramStore(telegramDataPath)
  const telegramRuntime = createTelegramRuntime({
    enabled: env.TELEGRAM_ENABLED,
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    inboundSessionId: env.TELEGRAM_INBOUND_SESSION_ID,
    pollIntervalSeconds: env.TELEGRAM_POLL_INTERVAL_SECONDS,
    ttsEnabled: env.TELEGRAM_TTS_ENABLED,
    retryEnabled: env.TELEGRAM_RETRY_ENABLED,
    maxRetries: env.TELEGRAM_MAX_RETRIES,
    retryBackoffSeconds: env.TELEGRAM_RETRY_BACKOFF_SECONDS,
  }, telegramStore, chatRuntime)
  const telegramRunner = startTelegramRunner(telegramRuntime, env.TELEGRAM_POLL_INTERVAL_SECONDS, env.TELEGRAM_ENABLED)
  const jellyfinAwarenessRunner = startJellyfinAwarenessRunner(env, chatRuntime)

  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/api/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
  }))

  app.use('/api/*', requireDeviceToken)
  app.route('/api/session', createSessionRoutes(chatRuntime))
  app.route('/api/chats', createChatRoutes(chatRuntime))
  app.route('/api/memory', createMemoryRoutes(chatRuntime))
  app.route('/api/integrations', createIntegrationRoutes(integrationRegistry))
  app.route('/api/reminders', createReminderRoutes(reminderRuntime))
  app.route('/api/telegram', createTelegramRoutes(telegramRuntime, telegramRunner))
  app.route('/api/jellyfin-awareness', createJellyfinAwarenessRoutes(jellyfinAwarenessRunner))

  logger.withFields({
    configuredDeviceTokens: deviceTokens.size,
    scopedTokens: deviceTokenScopes.size,
    integrations: integrationRegistry.map(integration => integration.id),
    sessionMaxMessages,
    chatDataPath,
    memoryDataPath,
    remindersDataPath,
    telegramDataPath,
    telegramEnabled: env.TELEGRAM_ENABLED,
    telegramPollIntervalSeconds: env.TELEGRAM_POLL_INTERVAL_SECONDS,
    telegramRetryEnabled: env.TELEGRAM_RETRY_ENABLED,
    telegramMaxRetries: env.TELEGRAM_MAX_RETRIES,
    jellyfinAwarenessEnabled: env.JELLYFIN_AWARENESS_ENABLED,
    jellyfinAwarenessIntervalSeconds: env.JELLYFIN_AWARENESS_INTERVAL_SECONDS,
    jellyfinAwarenessTriggerChance: env.JELLYFIN_AWARENESS_TRIGGER_CHANCE,
  }).log('Companion backend app initialized')

  return app
}

/**
 * Starts the companion backend HTTP server using validated environment config.
 */
function start() {
  initLogger(LoggerLevel.Debug, LoggerFormat.Pretty)

  const app = buildApp({
    deviceTokensRaw: parsedEnv.DEVICE_TOKENS,
    deviceTokenScopesRaw: parsedEnv.DEVICE_TOKEN_SCOPES,
    chatDataPath: parsedEnv.DATA_PATH_CHATS,
    memoryDataPath: parsedEnv.DATA_PATH_MEMORY,
    remindersDataPath: parsedEnv.DATA_PATH_REMINDERS,
    telegramDataPath: parsedEnv.DATA_PATH_TELEGRAM,
    sessionMaxMessages: parsedEnv.SESSION_MAX_MESSAGES,
    env: parsedEnv,
  })

  serve({ fetch: app.fetch, port: parsedEnv.PORT })
  useLogger('companion-backend').withFields({ port: parsedEnv.PORT }).log('Companion backend started')
}

start()
