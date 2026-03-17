import type { Context } from 'hono'

/**
 * Returns true when the authenticated token includes a required scope.
 */
export function hasScope(c: Context, requiredScope: string): boolean {
  const scopes = c.get('deviceTokenScopes') as Set<string> | undefined
  if (!scopes)
    return false

  return scopes.has(requiredScope)
}

/**
 * Creates a standardized forbidden JSON response for missing token scope.
 */
export function forbiddenForMissingScope(c: Context, requiredScope: string) {
  return c.json({ error: 'forbidden', message: `Missing required scope: ${requiredScope}` }, 403)
}
