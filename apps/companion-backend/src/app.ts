import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { parsedEnv } from './libs/env'
import { createDeviceTokenAuthMiddleware, parseConfiguredDeviceTokens } from './modules/auth/device-token'
import { createSessionRoutes } from './routes/session'

interface AppDeps {
  deviceTokensRaw: string
}

/**
 * Builds the companion backend app with health and authenticated API routes.
 */
function buildApp({ deviceTokensRaw }: AppDeps) {
  const app = new Hono()
  const logger = useLogger('companion-backend').useGlobalConfig()

  const deviceTokens = parseConfiguredDeviceTokens(deviceTokensRaw)
  const requireDeviceToken = createDeviceTokenAuthMiddleware(deviceTokens)

  app.get('/health', c => c.json({ status: 'ok' }))

  app.use('/api/*', requireDeviceToken)
  app.route('/api/session', createSessionRoutes())

  logger.withFields({ configuredDeviceTokens: deviceTokens.size }).log('Companion backend app initialized')

  return app
}

/**
 * Starts the companion backend HTTP server using validated environment config.
 */
function start() {
  initLogger(LoggerLevel.Debug, LoggerFormat.Pretty)

  const app = buildApp({
    deviceTokensRaw: parsedEnv.DEVICE_TOKENS,
  })

  serve({ fetch: app.fetch, port: parsedEnv.PORT })
  useLogger('companion-backend').withFields({ port: parsedEnv.PORT }).log('Companion backend started')
}

start()
