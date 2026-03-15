import type { Context, Next } from 'hono'

export type DeviceTokenScopeMap = Map<string, Set<string>>

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
 * Parses token scope config format: token:scopeA|scopeB,token2:scopeA
 */
export function parseDeviceTokenScopes(input: string): DeviceTokenScopeMap {
  const scopesByToken: DeviceTokenScopeMap = new Map()
  if (!input.trim())
    return scopesByToken

  for (const entry of input.split(',')) {
    const separatorIndex = entry.indexOf(':')
    if (separatorIndex <= 0)
      continue

    const token = entry.slice(0, separatorIndex).trim()
    const scopesPart = entry.slice(separatorIndex + 1)
    if (!token || !scopesPart)
      continue

    const scopes = new Set(scopesPart.split('|').map(scope => scope.trim()).filter(Boolean))
    scopesByToken.set(token, scopes)
  }

  return scopesByToken
}

/**
 * Creates auth middleware that validates trusted local device tokens for API routes.
 */
export function createDeviceTokenAuthMiddleware(allowedTokens: Set<string>, scopesByToken: DeviceTokenScopeMap) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header('Authorization'))

    if (!token || !allowedTokens.has(token)) {
      return c.json({ error: 'unauthorized', message: 'Valid device token is required.' }, 401)
    }

    c.set('deviceToken', token)
    c.set('deviceTokenScopes', scopesByToken.get(token) ?? new Set<string>())
    return next()
  }
}
