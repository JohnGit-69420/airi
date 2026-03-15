import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { parsedEnv } from './libs/env'
import { createChatRuntime } from './modules/chat/service'
import { createChatStore } from './modules/chat/store'
import { createMemoryStore } from './modules/memory/store'
import { createDeviceTokenAuthMiddleware, parseConfiguredDeviceTokens } from './modules/auth/device-token'
import { createChatRoutes } from './routes/chats'
import { createMemoryRoutes } from './routes/memory'
import { createSessionRoutes } from './routes/session'

interface AppDeps {
  deviceTokensRaw: string
  chatDataPath: string
  memoryDataPath: string
  sessionMaxMessages: number
}

/**
 * Builds the companion backend app with health and authenticated API routes.
 */
function buildApp({ deviceTokensRaw, chatDataPath, memoryDataPath, sessionMaxMessages }: AppDeps) {
  const app = new Hono()
  const logger = useLogger('companion-backend').useGlobalConfig()

  const deviceTokens = parseConfiguredDeviceTokens(deviceTokensRaw)
  const requireDeviceToken = createDeviceTokenAuthMiddleware(deviceTokens)

  const chatStore = createChatStore(chatDataPath)
  const memoryStore = createMemoryStore(memoryDataPath)
  const chatRuntime = createChatRuntime(chatStore, memoryStore, { sessionMaxMessages })

  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/api/*', requireDeviceToken)
  app.route('/api/session', createSessionRoutes(chatRuntime))
  app.route('/api/chats', createChatRoutes(chatRuntime))
  app.route('/api/memory', createMemoryRoutes(chatRuntime))

  logger.withFields({
    configuredDeviceTokens: deviceTokens.size,
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
    chatDataPath: parsedEnv.DATA_PATH_CHATS,
    memoryDataPath: parsedEnv.DATA_PATH_MEMORY,
    sessionMaxMessages: parsedEnv.SESSION_MAX_MESSAGES,
  })

  serve({ fetch: app.fetch, port: parsedEnv.PORT })
  useLogger('companion-backend').withFields({ port: parsedEnv.PORT }).log('Companion backend started')
}

start()
