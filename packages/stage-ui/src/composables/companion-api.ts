interface CompanionSession {
  id: string
}

interface CompanionSessionDetails {
  session: CompanionSession
  messages: Array<{
    id: string
    clientMessageId?: string
    role: 'system' | 'user' | 'assistant'
    content: string
    createdAt: string
  }>
}

const companionBaseUrl = import.meta.env.VITE_COMPANION_BACKEND_URL?.trim() ?? ''
const companionDeviceToken = import.meta.env.VITE_COMPANION_DEVICE_TOKEN?.trim() ?? ''

/**
 * Indicates whether companion-backend sync is explicitly enabled and configured.
 */
export function isCompanionSyncEnabled() {
  return import.meta.env.VITE_COMPANION_BACKEND_ENABLED === 'true'
    && companionBaseUrl.length > 0
    && companionDeviceToken.length > 0
}

function buildCompanionHeaders(existing?: HeadersInit) {
  const headers = new Headers(existing)
  headers.set('Authorization', `Bearer ${companionDeviceToken}`)
  headers.set('Content-Type', 'application/json')
  return headers
}

async function companionFetch(path: string, init: RequestInit) {
  const response = await fetch(`${companionBaseUrl}${path}`, {
    ...init,
    headers: buildCompanionHeaders(init.headers),
  })

  if (!response.ok)
    throw new Error(`Companion API request failed (${response.status}) for ${path}`)

  return response
}

/**
 * Creates a companion session for a client-side chat session.
 */
export async function createCompanionSession(input: { clientId: string, clientType: 'desktop' | 'web' | 'mobile' | 'other' }) {
  const response = await companionFetch('/api/session/create', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  const payload = await response.json() as { sessionId: string }
  return payload.sessionId
}

/**
 * Fetches companion session details used for write-through cursors.
 */
export async function getCompanionSessionDetails(sessionId: string): Promise<CompanionSessionDetails> {
  const response = await companionFetch(`/api/chats/${sessionId}`, {
    method: 'GET',
  })

  return await response.json() as CompanionSessionDetails
}

/**
 * Appends a chat message to the companion session.
 */
export async function appendCompanionMessage(input: { sessionId: string, role: 'system' | 'user' | 'assistant', content: string, clientMessageId?: string }) {
  await companionFetch(`/api/chats/${input.sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ role: input.role, content: input.content, clientMessageId: input.clientMessageId }),
  })
}
