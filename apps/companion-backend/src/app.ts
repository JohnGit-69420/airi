import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { parsedEnv } from './libs/env'
import { createDeviceTokenAuthMiddleware, parseConfiguredDeviceTokens, parseDeviceTokenScopes } from './modules/auth/device-token'
import { createChatRuntime } from './modules/chat/service'
import { createChatStore } from './modules/chat/store'
import { createIntegrationRegistry } from './modules/integrations/registry'
import { createMemoryStore } from './modules/memory/store'
import { createChatRoutes } from './routes/chats'
import { createIntegrationRoutes } from './routes/integrations'
import { createMemoryRoutes } from './routes/memory'
import { createSessionRoutes } from './routes/session'

interface AppDeps {
  deviceTokensRaw: string
  deviceTokenScopesRaw: string
  chatDataPath: string
  memoryDataPath: string
  sessionMaxMessages: number
}

/**
 * Builds the companion backend app with health and authenticated API routes.
 */
function buildApp({ deviceTokensRaw, deviceTokenScopesRaw, chatDataPath, memoryDataPath, sessionMaxMessages }: AppDeps) {
  const app = new Hono()
  const logger = useLogger('companion-backend').useGlobalConfig()

  const deviceTokens = parseConfiguredDeviceTokens(deviceTokensRaw)
  const deviceTokenScopes = parseDeviceTokenScopes(deviceTokenScopesRaw)
  const requireDeviceToken = createDeviceTokenAuthMiddleware(deviceTokens, deviceTokenScopes)

  const chatStore = createChatStore(chatDataPath)
  const memoryStore = createMemoryStore(memoryDataPath)
  const chatRuntime = createChatRuntime(chatStore, memoryStore, { sessionMaxMessages })
  const integrationRegistry = createIntegrationRegistry()

  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/api/*', requireDeviceToken)
  app.route('/api/session', createSessionRoutes(chatRuntime))
  app.route('/api/chats', createChatRoutes(chatRuntime))
  app.route('/api/memory', createMemoryRoutes(chatRuntime))
  app.route('/api/integrations', createIntegrationRoutes(integrationRegistry))

  logger.withFields({
    configuredDeviceTokens: deviceTokens.size,
    scopedTokens: deviceTokenScopes.size,
    integrations: integrationRegistry.map(integration => integration.id),
    sessionMaxMessages,
    chatDataPath,
    memoryDataPath,
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
    sessionMaxMessages: parsedEnv.SESSION_MAX_MESSAGES,
  })

  serve({ fetch: app.fetch, port: parsedEnv.PORT })
  useLogger('companion-backend').withFields({ port: parsedEnv.PORT }).log('Companion backend started')
}

start()
