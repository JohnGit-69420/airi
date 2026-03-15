import type { Env } from '../../libs/env'
import type { createChatRuntime } from '../chat/service'

import { useLogger } from '@guiiai/logg'

import { runJellyfinAwarenessTick } from './jellyfin-awareness'

/**
 * Starts a periodic Jellyfin awareness polling loop and returns a disposer.
 */
export function startJellyfinAwarenessRunner(env: Env, chatRuntime: ReturnType<typeof createChatRuntime>) {
  const logger = useLogger('companion-backend:jellyfin-awareness')
  const state = {
    lastMediaFingerprint: '',
    lastPromptAt: '',
  }

  const config = {
    enabled: env.JELLYFIN_AWARENESS_ENABLED,
    baseUrl: env.JELLYFIN_BASE_URL,
    apiKey: env.JELLYFIN_API_KEY,
    userId: env.JELLYFIN_USER_ID,
    targetSessionId: env.JELLYFIN_TARGET_SESSION_ID,
    intervalSeconds: env.JELLYFIN_AWARENESS_INTERVAL_SECONDS,
    triggerChance: env.JELLYFIN_AWARENESS_TRIGGER_CHANCE,
    suppressSameMedia: env.JELLYFIN_SUPPRESS_SAME_MEDIA,
    promptTemplate: env.JELLYFIN_AWARENESS_PROMPT_TEMPLATE,
    llmBaseUrl: env.JELLYFIN_AWARENESS_LLM_BASE_URL,
    llmModel: env.JELLYFIN_AWARENESS_LLM_MODEL,
    llmApiKey: env.JELLYFIN_AWARENESS_LLM_API_KEY,
  }

  if (!config.enabled) {
    logger.log('Jellyfin awareness runner disabled by config')
    return {
      stop() {},
      runOnce: async () => ({ status: 'disabled', reason: 'Jellyfin awareness is disabled.' as const }),
    }
  }

  const runOnce = async () => {
    const result = await runJellyfinAwarenessTick({
      config,
      chatRuntime,
      state,
      random: Math.random,
    })

    logger.withFields(result).log('Jellyfin awareness tick finished')
    return result
  }

  const intervalMs = Math.max(30, config.intervalSeconds) * 1000
  const timer = setInterval(() => {
    void runOnce()
  }, intervalMs)

  timer.unref()

  logger.withFields({
    intervalSeconds: config.intervalSeconds,
    triggerChance: config.triggerChance,
    suppressSameMedia: config.suppressSameMedia,
    hasUserFilter: !!config.userId,
    targetSessionId: config.targetSessionId,
  }).log('Jellyfin awareness runner started')

  return {
    stop() {
      clearInterval(timer)
    },
    runOnce,
  }
}
