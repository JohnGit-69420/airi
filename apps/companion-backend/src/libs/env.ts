import type { InferOutput } from 'valibot'

import { env as processEnv } from 'node:process'

import { object, optional, parse, pipe, string, minLength } from 'valibot'

const RawEnvSchema = object({
  PORT: optional(string(), '3100'),
  DEVICE_TOKENS: pipe(string(), minLength(1, 'DEVICE_TOKENS must include at least one token')),
})

type RawEnv = InferOutput<typeof RawEnvSchema>

export interface Env {
  PORT: number
  DEVICE_TOKENS: string
}

/**
 * Parses and validates backend environment variables used by the companion backend.
 */
export function parseEnv(input: Record<string, string | undefined>): Env {
  const raw = parse(RawEnvSchema, input) as RawEnv
  const parsedPort = Number.parseInt(raw.PORT, 10)

  if (!Number.isFinite(parsedPort) || parsedPort <= 0)
    throw new Error('PORT must be a positive integer')

  return {
    PORT: parsedPort,
    DEVICE_TOKENS: raw.DEVICE_TOKENS,
  }
}

/**
 * Eagerly parses process env so startup fails fast when config is invalid.
 */
export const parsedEnv = parseEnv(processEnv)
