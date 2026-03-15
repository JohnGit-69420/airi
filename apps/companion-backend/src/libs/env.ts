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

  return {
    PORT: port,
    DEVICE_TOKENS: raw.DEVICE_TOKENS,
    DEVICE_TOKEN_SCOPES: raw.DEVICE_TOKEN_SCOPES,
    DATA_PATH_CHATS: raw.DATA_PATH_CHATS,
    DATA_PATH_MEMORY: raw.DATA_PATH_MEMORY,
    DATA_PATH_REMINDERS: raw.DATA_PATH_REMINDERS,
    SESSION_MAX_MESSAGES: sessionMaxMessages,
  }
}

/**
 * Eagerly parses process env so startup fails fast when config is invalid.
 */
export const parsedEnv = parseEnv(processEnv)
