import type { createChatRuntime } from '../chat/service'

export interface JellyfinAwarenessConfig {
  enabled: boolean
  baseUrl: string
  apiKey: string
  userId: string
  targetSessionId: string
  intervalSeconds: number
  triggerChance: number
  suppressSameMedia: boolean
  promptTemplate: string
  llmBaseUrl: string
  llmModel: string
  llmApiKey: string
}

interface JellyfinSession {
  Id?: string
  UserId?: string
  DeviceName?: string
  Client?: string
  NowPlayingItem?: {
    Id?: string
    Name?: string
    Type?: string
    SeriesName?: string
    Album?: string
    Artists?: string[]
    RunTimeTicks?: number
    ProductionYear?: number
  }
  PlayState?: {
    PositionTicks?: number
    IsPaused?: boolean
  }
}

export interface JellyfinAwarenessState {
  lastMediaFingerprint: string
  lastPromptAt: string
}

export interface JellyfinAwarenessTickResult {
  status: 'disabled' | 'misconfigured' | 'no_media' | 'suppressed' | 'chance_skip' | 'delivered' | 'delivery_failed'
  mediaFingerprint?: string
  reason?: string
}

interface TickDeps {
  config: JellyfinAwarenessConfig
  chatRuntime: ReturnType<typeof createChatRuntime>
  state: JellyfinAwarenessState
  random: () => number
}

function buildSessionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/Sessions`
}

function buildMediaFingerprint(session: JellyfinSession): string {
  const item = session.NowPlayingItem
  const mediaId = item?.Id ?? item?.Name ?? 'unknown-media'
  const position = session.PlayState?.PositionTicks ?? 0
  return `${session.UserId ?? 'unknown-user'}:${mediaId}:${position}`
}

function buildSuppressionFingerprint(session: JellyfinSession): string {
  const item = session.NowPlayingItem
  const mediaId = item?.Id ?? item?.Name ?? 'unknown-media'
  return `${session.UserId ?? 'unknown-user'}:${mediaId}`
}

function renderPrompt(template: string, session: JellyfinSession): string {
  const item = session.NowPlayingItem
  const artist = item?.Artists?.[0] ?? 'unknown artist'
  const mediaName = item?.Name ?? 'unknown media'
  const mediaType = item?.Type ?? 'unknown type'

  return template
    .replaceAll('{{mediaName}}', mediaName)
    .replaceAll('{{mediaType}}', mediaType)
    .replaceAll('{{artist}}', artist)
    .replaceAll('{{deviceName}}', session.DeviceName ?? 'unknown device')
}

async function fetchCurrentSession(config: JellyfinAwarenessConfig): Promise<JellyfinSession | null> {
  const response = await fetch(buildSessionsUrl(config.baseUrl), {
    headers: {
      'X-Emby-Token': config.apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok)
    throw new Error(`Jellyfin sessions request failed: ${response.status}`)

  const sessions = await response.json() as JellyfinSession[]
  const playingSessions = sessions.filter(session => !!session.NowPlayingItem)
  if (!config.userId)
    return playingSessions[0] ?? null

  return playingSessions.find(session => session.UserId === config.userId) ?? null
}

async function generateComment(config: JellyfinAwarenessConfig, prompt: string, session: JellyfinSession): Promise<string> {
  if (!config.llmBaseUrl || !config.llmModel) {
    const mediaName = session.NowPlayingItem?.Name ?? 'something'
    const mediaType = session.NowPlayingItem?.Type ?? 'media'
    return `I can tell you're enjoying ${mediaType.toLowerCase()} "${mediaName}" right now.`
  }

  const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.llmApiKey ? { Authorization: `Bearer ${config.llmApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({
            jellyfinSession: session,
          }),
        },
      ],
    }),
  })

  if (!response.ok)
    throw new Error(`LLM request failed: ${response.status}`)

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content)
    throw new Error('LLM returned empty awareness response')

  return content
}

/**
 * Performs one Jellyfin awareness tick and optionally injects an assistant message into the chat session.
 */
export async function runJellyfinAwarenessTick({ config, chatRuntime, state, random }: TickDeps): Promise<JellyfinAwarenessTickResult> {
  if (!config.enabled)
    return { status: 'disabled', reason: 'JELLYFIN_AWARENESS_ENABLED is false.' }

  if (!config.baseUrl || !config.apiKey || !config.targetSessionId)
    return { status: 'misconfigured', reason: 'Missing Jellyfin base URL, API key, or target session ID.' }

  const session = await fetchCurrentSession(config)
  if (!session || !session.NowPlayingItem)
    return { status: 'no_media', reason: 'No currently playing media found for configured user.' }

  const mediaFingerprint = buildMediaFingerprint(session)
  const suppressionFingerprint = buildSuppressionFingerprint(session)

  if (config.suppressSameMedia && state.lastMediaFingerprint === suppressionFingerprint) {
    return {
      status: 'suppressed',
      mediaFingerprint,
      reason: 'Same media suppression is active for the currently playing item.',
    }
  }

  if (random() > config.triggerChance) {
    return {
      status: 'chance_skip',
      mediaFingerprint,
      reason: 'Random trigger chance skipped this awareness tick.',
    }
  }

  const prompt = renderPrompt(config.promptTemplate, session)

  try {
    const comment = await generateComment(config, prompt, session)
    await chatRuntime.addMessage({
      sessionId: config.targetSessionId,
      role: 'assistant',
      content: comment,
    })

    state.lastMediaFingerprint = suppressionFingerprint
    state.lastPromptAt = new Date().toISOString()

    return {
      status: 'delivered',
      mediaFingerprint,
    }
  }
  catch (error) {
    return {
      status: 'delivery_failed',
      mediaFingerprint,
      reason: error instanceof Error ? error.message : 'Unknown Jellyfin awareness delivery error.',
    }
  }
}
