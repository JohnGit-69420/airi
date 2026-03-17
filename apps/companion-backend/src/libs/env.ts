import type { InferOutput } from 'valibot'

import { env as processEnv } from 'node:process'

import { minLength, object, optional, parse, pipe, string } from 'valibot'

const RawEnvSchema = object({
  PORT: optional(string(), '3100'),
  DEVICE_TOKENS: pipe(string(), minLength(1, 'DEVICE_TOKENS must include at least one token')),
  DEVICE_TOKEN_SCOPES: optional(string(), 'desktop-dev-token:integrations:read|integrations:invoke:system-info'),
  DATA_PATH_CHATS: optional(string(), './.data/chats.json'),
  DATA_PATH_MEMORY: optional(string(), './.data/memory.json'),
  MEMORY_PROVIDER: optional(string(), 'local'),
  MEM0_BASE_URL: optional(string(), ''),
  MEM0_API_KEY: optional(string(), ''),
  MEM0_AUTH_SCHEME: optional(string(), 'bearer'),
  MEM0_APP_ID: optional(string(), ''),
  MEM0_ORG_ID: optional(string(), ''),
  MEM0_PROJECT_ID: optional(string(), ''),
  DATA_PATH_REMINDERS: optional(string(), './.data/reminders.json'),

  DATA_PATH_TELEGRAM: optional(string(), './.data/telegram.json'),

  TELEGRAM_ENABLED: optional(string(), 'false'),
  TELEGRAM_BOT_TOKEN: optional(string(), ''),
  TELEGRAM_CHAT_ID: optional(string(), ''),
  TELEGRAM_INBOUND_SESSION_ID: optional(string(), ''),
  TELEGRAM_POLL_INTERVAL_SECONDS: optional(string(), '30'),
  TELEGRAM_TTS_ENABLED: optional(string(), 'false'),
  TELEGRAM_RETRY_ENABLED: optional(string(), 'true'),
  TELEGRAM_MAX_RETRIES: optional(string(), '3'),
  TELEGRAM_RETRY_BACKOFF_SECONDS: optional(string(), '60'),
  JELLYFIN_AWARENESS_ENABLED: optional(string(), 'false'),
  JELLYFIN_BASE_URL: optional(string(), ''),
  JELLYFIN_API_KEY: optional(string(), ''),
  JELLYFIN_USER_ID: optional(string(), ''),
  JELLYFIN_TARGET_SESSION_ID: optional(string(), ''),
  JELLYFIN_AWARENESS_INTERVAL_SECONDS: optional(string(), '300'),
  JELLYFIN_AWARENESS_TRIGGER_CHANCE: optional(string(), '0.5'),
  JELLYFIN_SUPPRESS_SAME_MEDIA: optional(string(), 'true'),
  JELLYFIN_AWARENESS_PROMPT_TEMPLATE: optional(string(), 'You are roleplaying as the current character. The user is currently consuming {{mediaType}} named "{{mediaName}}" by "{{artist}}" on {{deviceName}}. React naturally in-character in 1-2 sentences and do not mention raw JSON or APIs.'),
  JELLYFIN_AWARENESS_LLM_BASE_URL: optional(string(), ''),
  JELLYFIN_AWARENESS_LLM_MODEL: optional(string(), ''),
  JELLYFIN_AWARENESS_LLM_API_KEY: optional(string(), ''),
  SESSION_MAX_MESSAGES: optional(string(), '20'),
})

type RawEnv = InferOutput<typeof RawEnvSchema>

export interface Env {
  PORT: number
  DEVICE_TOKENS: string
  DEVICE_TOKEN_SCOPES: string
  DATA_PATH_CHATS: string
  DATA_PATH_MEMORY: string
  MEMORY_PROVIDER: 'local' | 'mem0'
  MEM0_BASE_URL: string
  MEM0_API_KEY: string
  MEM0_AUTH_SCHEME: 'bearer' | 'token' | 'api-key'
  MEM0_APP_ID: string
  MEM0_ORG_ID: string
  MEM0_PROJECT_ID: string
  DATA_PATH_REMINDERS: string

  DATA_PATH_TELEGRAM: string

  TELEGRAM_ENABLED: boolean
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHAT_ID: string
  TELEGRAM_INBOUND_SESSION_ID: string
  TELEGRAM_POLL_INTERVAL_SECONDS: number
  TELEGRAM_TTS_ENABLED: boolean
  TELEGRAM_RETRY_ENABLED: boolean
  TELEGRAM_MAX_RETRIES: number
  TELEGRAM_RETRY_BACKOFF_SECONDS: number

  JELLYFIN_AWARENESS_ENABLED: boolean
  JELLYFIN_BASE_URL: string
  JELLYFIN_API_KEY: string
  JELLYFIN_USER_ID: string
  JELLYFIN_TARGET_SESSION_ID: string
  JELLYFIN_AWARENESS_INTERVAL_SECONDS: number
  JELLYFIN_AWARENESS_TRIGGER_CHANCE: number
  JELLYFIN_SUPPRESS_SAME_MEDIA: boolean
  JELLYFIN_AWARENESS_PROMPT_TEMPLATE: string
  JELLYFIN_AWARENESS_LLM_BASE_URL: string
  JELLYFIN_AWARENESS_LLM_MODEL: string
  JELLYFIN_AWARENESS_LLM_API_KEY: string
  SESSION_MAX_MESSAGES: number
}

/**
 * Parses and validates backend environment variables used by the companion backend.
 */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const raw = parse(RawEnvSchema, input) as RawEnv
  const port = Number.parseInt(raw.PORT, 10)
  const sessionMaxMessages = Number.parseInt(raw.SESSION_MAX_MESSAGES, 10)

  if (!Number.isFinite(port) || port <= 0)
    throw new Error('PORT must be a positive integer')

  if (!Number.isFinite(sessionMaxMessages) || sessionMaxMessages <= 0)
    throw new Error('SESSION_MAX_MESSAGES must be a positive integer')

  const memoryProvider = raw.MEMORY_PROVIDER === 'mem0' ? 'mem0' : 'local'
  const mem0AuthScheme: Env['MEM0_AUTH_SCHEME']
    = raw.MEM0_AUTH_SCHEME === 'token'
      ? 'token'
      : raw.MEM0_AUTH_SCHEME === 'api-key'
        ? 'api-key'
        : 'bearer'

  const telegramPollIntervalSeconds = Number.parseInt(raw.TELEGRAM_POLL_INTERVAL_SECONDS, 10)
  if (!Number.isFinite(telegramPollIntervalSeconds) || telegramPollIntervalSeconds <= 0)
    throw new Error('TELEGRAM_POLL_INTERVAL_SECONDS must be a positive integer')

  const telegramEnabled = raw.TELEGRAM_ENABLED === 'true'
  const telegramTtsEnabled = raw.TELEGRAM_TTS_ENABLED === 'true'
  const telegramRetryEnabled = raw.TELEGRAM_RETRY_ENABLED === 'true'

  const telegramMaxRetries = Number.parseInt(raw.TELEGRAM_MAX_RETRIES, 10)
  const telegramRetryBackoffSeconds = Number.parseInt(raw.TELEGRAM_RETRY_BACKOFF_SECONDS, 10)

  if (!Number.isFinite(telegramMaxRetries) || telegramMaxRetries <= 0)
    throw new Error('TELEGRAM_MAX_RETRIES must be a positive integer')

  if (!Number.isFinite(telegramRetryBackoffSeconds) || telegramRetryBackoffSeconds <= 0)
    throw new Error('TELEGRAM_RETRY_BACKOFF_SECONDS must be a positive integer')

  const jellyfinIntervalSeconds = Number.parseInt(raw.JELLYFIN_AWARENESS_INTERVAL_SECONDS, 10)
  const jellyfinTriggerChance = Number.parseFloat(raw.JELLYFIN_AWARENESS_TRIGGER_CHANCE)

  if (!Number.isFinite(jellyfinIntervalSeconds) || jellyfinIntervalSeconds <= 0)
    throw new Error('JELLYFIN_AWARENESS_INTERVAL_SECONDS must be a positive integer')

  if (!Number.isFinite(jellyfinTriggerChance) || jellyfinTriggerChance < 0 || jellyfinTriggerChance > 1)
    throw new Error('JELLYFIN_AWARENESS_TRIGGER_CHANCE must be between 0 and 1')

  const jellyfinAwarenessEnabled = raw.JELLYFIN_AWARENESS_ENABLED === 'true'
  const jellyfinSuppressSameMedia = raw.JELLYFIN_SUPPRESS_SAME_MEDIA === 'true'

  return {
    PORT: port,
    DEVICE_TOKENS: raw.DEVICE_TOKENS,
    DEVICE_TOKEN_SCOPES: raw.DEVICE_TOKEN_SCOPES,
    DATA_PATH_CHATS: raw.DATA_PATH_CHATS,
    DATA_PATH_MEMORY: raw.DATA_PATH_MEMORY,
    MEMORY_PROVIDER: memoryProvider,
    MEM0_BASE_URL: raw.MEM0_BASE_URL,
    MEM0_API_KEY: raw.MEM0_API_KEY,
    MEM0_AUTH_SCHEME: mem0AuthScheme,
    MEM0_APP_ID: raw.MEM0_APP_ID,
    MEM0_ORG_ID: raw.MEM0_ORG_ID,
    MEM0_PROJECT_ID: raw.MEM0_PROJECT_ID,
    DATA_PATH_REMINDERS: raw.DATA_PATH_REMINDERS,

    DATA_PATH_TELEGRAM: raw.DATA_PATH_TELEGRAM,

    TELEGRAM_ENABLED: telegramEnabled,
    TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: raw.TELEGRAM_CHAT_ID,
    TELEGRAM_INBOUND_SESSION_ID: raw.TELEGRAM_INBOUND_SESSION_ID,
    TELEGRAM_POLL_INTERVAL_SECONDS: telegramPollIntervalSeconds,
    TELEGRAM_TTS_ENABLED: telegramTtsEnabled,
    TELEGRAM_RETRY_ENABLED: telegramRetryEnabled,
    TELEGRAM_MAX_RETRIES: telegramMaxRetries,
    TELEGRAM_RETRY_BACKOFF_SECONDS: telegramRetryBackoffSeconds,

    JELLYFIN_AWARENESS_ENABLED: jellyfinAwarenessEnabled,
    JELLYFIN_BASE_URL: raw.JELLYFIN_BASE_URL,
    JELLYFIN_API_KEY: raw.JELLYFIN_API_KEY,
    JELLYFIN_USER_ID: raw.JELLYFIN_USER_ID,
    JELLYFIN_TARGET_SESSION_ID: raw.JELLYFIN_TARGET_SESSION_ID,
    JELLYFIN_AWARENESS_INTERVAL_SECONDS: jellyfinIntervalSeconds,
    JELLYFIN_AWARENESS_TRIGGER_CHANCE: jellyfinTriggerChance,
    JELLYFIN_SUPPRESS_SAME_MEDIA: jellyfinSuppressSameMedia,
    JELLYFIN_AWARENESS_PROMPT_TEMPLATE: raw.JELLYFIN_AWARENESS_PROMPT_TEMPLATE,
    JELLYFIN_AWARENESS_LLM_BASE_URL: raw.JELLYFIN_AWARENESS_LLM_BASE_URL,
    JELLYFIN_AWARENESS_LLM_MODEL: raw.JELLYFIN_AWARENESS_LLM_MODEL,
    JELLYFIN_AWARENESS_LLM_API_KEY: raw.JELLYFIN_AWARENESS_LLM_API_KEY,
    SESSION_MAX_MESSAGES: sessionMaxMessages,
  }
}

/**
 * Eagerly parses process env so startup fails fast when config is invalid.
 */
export const parsedEnv = parseEnv(processEnv)
