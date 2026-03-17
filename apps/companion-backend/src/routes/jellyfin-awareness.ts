import { Hono } from 'hono'

interface JellyfinAwarenessRunner {
  runOnce: () => Promise<unknown>
}

/**
 * Creates administrative routes for manual Jellyfin awareness polling.
 */
export function createJellyfinAwarenessRoutes(runner: JellyfinAwarenessRunner) {
  return new Hono().post('/tick', async c => c.json(await runner.runOnce()))
}
