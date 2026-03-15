import type { createTelegramRuntime } from './telegram'

import { useLogger } from '@guiiai/logg'

/**
 * Starts periodic Telegram polling loop.
 */
export function startTelegramRunner(runtime: ReturnType<typeof createTelegramRuntime>, intervalSeconds: number, enabled: boolean) {
  const logger = useLogger('companion-backend:telegram')

  if (!enabled) {
    logger.log('Telegram runner disabled by config')
    return {
      stop() {},
      pollOnce: runtime.pollInbound,
    }
  }

  const intervalMs = Math.max(15, intervalSeconds) * 1000
  const timer = setInterval(() => {
    void runtime.pollInbound()
      .then(result => logger.withFields(result).log('Telegram poll tick finished'))
      .catch((error) => {
        logger.withField('error', error instanceof Error ? error.message : String(error)).warn('Telegram poll tick failed')
      })
  }, intervalMs)

  timer.unref()

  logger.withFields({ intervalSeconds }).log('Telegram runner started')

  return {
    stop() {
      clearInterval(timer)
    },
    pollOnce: runtime.pollInbound,
  }
}
