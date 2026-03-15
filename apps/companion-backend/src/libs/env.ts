import type { InferOutput } from 'valibot'

import { env as processEnv } from 'node:process'

import { minLength, object, optional, parse, pipe, string } from 'valibot'

const RawEnvSchema = object({
  PORT: optional(string(), '3100'),
  DEVICE_TOKENS: pipe(string(), minLength(1, 'DEVICE_TOKENS must include at least one token')),
  DEVICE_TOKEN_SCOPES: optional(string(), 'desktop-dev-token:integrations:read|integrations:invoke:system-info'),
  DATA_PATH_CHATS: optional(string(), './.data/chats.json'),
  DATA_PATH_MEMORY: optional(string(), './.data/memory.json'),
  DATA_PATH_REMINDERS: optional(string(), './.data/reminders.json'),

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
  DATA_PATH_REMINDERS: string

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
    DATA_PATH_REMINDERS: raw.DATA_PATH_REMINDERS,

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
