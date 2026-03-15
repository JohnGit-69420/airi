import process from 'node:process'

export interface IntegrationDefinition {
  id: string
  displayName: string
  description: string
  requiredScope: string
  invoke: (input?: unknown) => Promise<unknown>
}

/**
 * Builds integration definitions available in the companion backend.
 */
export function createIntegrationRegistry(): IntegrationDefinition[] {
  return [
    {
      id: 'system-info',
      displayName: 'System Info',
      description: 'Read-only local backend runtime diagnostics.',
      requiredScope: 'integrations:invoke:system-info',
      invoke: async () => ({
        platform: process.platform,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsage: process.memoryUsage(),
      }),
    },
  ]
}
