import type { Context, Next } from 'hono'

/**
 * Extracts bearer token from Authorization header.
 */
function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader)
    return null

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme !== 'Bearer' || !token)
    return null

  return token
}

/**
 * Parses configured device tokens from comma-separated env string.
 */
export function parseConfiguredDeviceTokens(input: string): Set<string> {
  return new Set(
    input
      .split(',')
      .map(part => part.trim())
      .filter(Boolean),
  )
}

/**
 * Creates auth middleware that validates trusted local device tokens for API routes.
 */
export function createDeviceTokenAuthMiddleware(allowedTokens: Set<string>) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header('Authorization'))

    if (!token || !allowedTokens.has(token)) {
      return c.json({ error: 'unauthorized', message: 'Valid device token is required.' }, 401)
    }

    return next()
  }
}
