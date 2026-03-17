import type { IntegrationDefinition } from '../modules/integrations/registry'

import { Hono } from 'hono'

import { forbiddenForMissingScope, hasScope } from '../modules/permissions/scopes'

/**
 * Creates integration routes with scope-based access control.
 */
export function createIntegrationRoutes(registry: IntegrationDefinition[]) {
  return new Hono()
    .get('/', async (c) => {
      const visible = registry
        .filter(integration => hasScope(c, integration.requiredScope) || hasScope(c, 'integrations:read'))
        .map(integration => ({
          id: integration.id,
          displayName: integration.displayName,
          description: integration.description,
          requiredScope: integration.requiredScope,
        }))

      return c.json({ integrations: visible })
    })

    .post('/:integrationId/invoke', async (c) => {
      const integrationId = c.req.param('integrationId')
      const integration = registry.find(candidate => candidate.id === integrationId)
      if (!integration)
        return c.json({ error: 'not_found', message: 'Integration not found.' }, 404)

      if (!hasScope(c, integration.requiredScope))
        return forbiddenForMissingScope(c, integration.requiredScope)

      let input: unknown
      try {
        input = await c.req.json()
      }
      catch {
        // NOTICE: Empty body is expected for simple read-only integrations.
      }

      const output = await integration.invoke(input)
      return c.json({ integrationId, output })
    })
}
