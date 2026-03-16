import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  clientMessageId?: string
  sessionId: string
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatSession {
  id: string
  clientId: string
  clientType: 'desktop' | 'web' | 'mobile' | 'other'
  createdAt: string
  parentSessionId?: string
}

interface ChatDatabase {
  sessions: ChatSession[]
  messages: ChatMessage[]
}

const EMPTY_DB: ChatDatabase = {
  sessions: [],
  messages: [],
}

/**
 * Reads JSON persistence from disk if available; otherwise returns empty storage.
 */
async function readDatabase(dataPath: string): Promise<ChatDatabase> {
  try {
    const raw = await readFile(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ChatDatabase>

    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    }
  }
  catch {
    return { ...EMPTY_DB }
  }
}

/**
 * Writes JSON persistence atomically enough for single-process local development use.
 */
async function writeDatabase(dataPath: string, database: ChatDatabase): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true })
  await writeFile(dataPath, JSON.stringify(database, null, 2), 'utf-8')
}

/**
 * Creates chat persistence store for sessions and message history.
 */
export function createChatStore(dataPath: string) {
  return {
    async createSession(input: { clientId: string, clientType: ChatSession['clientType'], parentSessionId?: string }): Promise<ChatSession> {
      const database = await readDatabase(dataPath)

      const session: ChatSession = {
        id: crypto.randomUUID(),
        clientId: input.clientId,
        clientType: input.clientType,
        createdAt: new Date().toISOString(),
        parentSessionId: input.parentSessionId,
      }

      database.sessions.push(session)
      await writeDatabase(dataPath, database)
      return session
    },

    async addMessage(input: { sessionId: string, role: ChatRole, content: string, clientMessageId?: string }): Promise<ChatMessage> {
      const database = await readDatabase(dataPath)
      const session = database.sessions.find(candidate => candidate.id === input.sessionId)
      if (!session)
        throw new Error(`Session not found: ${input.sessionId}`)

      if (input.clientMessageId) {
        const existing = database.messages.find(message => message.sessionId === input.sessionId && message.clientMessageId === input.clientMessageId)
        if (existing)
          return existing
      }

      // NOTICE: Companion sync can occasionally retry the same payload without a stable
      // clientMessageId (for example during transient reconnect windows). Guard against
      // immediate duplicated writes by reusing an existing consecutive message when both
      // role and content match exactly.
      const latestForSession = database.messages
        .filter(message => message.sessionId === input.sessionId)
        .at(-1)
      if (latestForSession && latestForSession.role === input.role && latestForSession.content === input.content)
        return latestForSession

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        clientMessageId: input.clientMessageId,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        createdAt: new Date().toISOString(),
      }

      database.messages.push(message)
      await writeDatabase(dataPath, database)
      return message
    },

    async getSession(sessionId: string): Promise<ChatSession | undefined> {
      const database = await readDatabase(dataPath)
      return database.sessions.find(session => session.id === sessionId)
    },

    async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
      const database = await readDatabase(dataPath)
      return database.messages
        .filter(message => message.sessionId === sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
  }
}
