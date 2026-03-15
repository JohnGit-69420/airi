import type { Env } from './libs/env'

import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { parsedEnv } from './libs/env'
import { createDeviceTokenAuthMiddleware, parseConfiguredDeviceTokens, parseDeviceTokenScopes } from './modules/auth/device-token'
import { createChatRuntime } from './modules/chat/service'
import { createChatStore } from './modules/chat/store'
import { startJellyfinAwarenessRunner } from './modules/integrations/jellyfin-awareness-runner'
import { createIntegrationRegistry } from './modules/integrations/registry'
import { createMemoryStore } from './modules/memory/store'
import { createReminderRuntime } from './modules/reminders/service'
import { createReminderStore } from './modules/reminders/store'
import { createChatRoutes } from './routes/chats'
import { createIntegrationRoutes } from './routes/integrations'
import { createJellyfinAwarenessRoutes } from './routes/jellyfin-awareness'
import { createMemoryRoutes } from './routes/memory'
import { createReminderRoutes } from './routes/reminders'
import { createSessionRoutes } from './routes/session'

interface AppDeps {
  deviceTokensRaw: string
  deviceTokenScopesRaw: string
  chatDataPath: string
  memoryDataPath: string
  remindersDataPath: string
  sessionMaxMessages: number
  env: Env
}

/**
 * Builds the companion backend app with health and authenticated API routes.
 */
function buildApp({ deviceTokensRaw, deviceTokenScopesRaw, chatDataPath, memoryDataPath, remindersDataPath, sessionMaxMessages, env }: AppDeps) {
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
  const jellyfinAwarenessRunner = startJellyfinAwarenessRunner(env, chatRuntime)

  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/api/*', requireDeviceToken)
  app.route('/api/session', createSessionRoutes(chatRuntime))
  app.route('/api/chats', createChatRoutes(chatRuntime))
  app.route('/api/memory', createMemoryRoutes(chatRuntime))
  app.route('/api/integrations', createIntegrationRoutes(integrationRegistry))
  app.route('/api/reminders', createReminderRoutes(reminderRuntime))
  app.route('/api/jellyfin-awareness', createJellyfinAwarenessRoutes(jellyfinAwarenessRunner))

  logger.withFields({
    configuredDeviceTokens: deviceTokens.size,
    scopedTokens: deviceTokenScopes.size,
    integrations: integrationRegistry.map(integration => integration.id),
    sessionMaxMessages,
    chatDataPath,
    memoryDataPath,
    remindersDataPath,
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
    sessionMaxMessages: parsedEnv.SESSION_MAX_MESSAGES,
    env: parsedEnv,
  })

  serve({ fetch: app.fetch, port: parsedEnv.PORT })
  useLogger('companion-backend').withFields({ port: parsedEnv.PORT }).log('Companion backend started')
}

start()
