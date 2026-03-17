import type { ChatMessage } from '../chat/store'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface MemoryEntry {
  id: string
  sourceSessionId: string
  summary: string
  createdAt: string
}

export interface MemoryStoreContract {
  compactSessionToMemory: (sessionId: string, messages: ChatMessage[]) => Promise<MemoryEntry>
  getRecentMemories: (limit?: number) => Promise<MemoryEntry[]>
  searchMemories: (query: string, limit?: number, sessionId?: string, appId?: string) => Promise<MemoryEntry[]>
  rememberMessage: (sessionId: string, role: ChatMessage['role'], content: string, appId?: string) => Promise<MemoryEntry | null>
}

interface MemoryDatabase {
  memories: MemoryEntry[]
}

const EMPTY_DB: MemoryDatabase = {
  memories: [],
}

/**
 * Reads memory persistence from disk if available; otherwise returns empty storage.
 */
async function readDatabase(dataPath: string): Promise<MemoryDatabase> {
  try {
    const raw = await readFile(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<MemoryDatabase>

    return {
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
    }
  }
  catch {
    return { ...EMPTY_DB }
  }
}

/**
 * Writes memory persistence for local single-process execution.
 */
async function writeDatabase(dataPath: string, database: MemoryDatabase): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true })
  await writeFile(dataPath, JSON.stringify(database, null, 2), 'utf-8')
}

/**
 * Creates short summary text for a session, bounded for predictable context payload size.
 */
function summarizeMessages(messages: ChatMessage[]): string {
  return messages
    .slice(-6)
    .map(message => `${message.role}: ${message.content}`)
    .join('\n')
    .slice(0, 1200)
}

function normalizeMemoryText(content: string) {
  return content
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function scoreMemory(summary: string, queryTerms: string[]) {
  const lowerSummary = summary.toLowerCase()
  return queryTerms.reduce((score, term) => score + (lowerSummary.includes(term) ? 1 : 0), 0)
}

function shouldRememberContent(content: string) {
  const normalized = content.toLowerCase()

  // NOTICE: Local JSON memory path uses deterministic heuristics until an always-on
  // classifier is introduced for non-mem0 providers.
  const factHints = [
    'my favorite',
    'i work at',
    'i work in',
    'i live in',
    'my name is',
    'i prefer',
    'i like',
    'i dislike',
    'my birthday',
    'remember that',
  ]

  return factHints.some(hint => normalized.includes(hint))
}

/**
 * Creates memory persistence store with summary-based retrieval.
 */
export function createMemoryStore(dataPath: string): MemoryStoreContract {
  return {
    async compactSessionToMemory(sessionId: string, messages: ChatMessage[]): Promise<MemoryEntry> {
      const database = await readDatabase(dataPath)

      const entry: MemoryEntry = {
        id: crypto.randomUUID(),
        sourceSessionId: sessionId,
        summary: summarizeMessages(messages),
        createdAt: new Date().toISOString(),
      }

      database.memories.push(entry)
      await writeDatabase(dataPath, database)
      return entry
    },

    async getRecentMemories(limit = 3): Promise<MemoryEntry[]> {
      const database = await readDatabase(dataPath)
      return [...database.memories]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
    },

    async searchMemories(query: string, limit = 3, sessionId?: string): Promise<MemoryEntry[]> {
      const database = await readDatabase(dataPath)
      const queryTerms = query.toLowerCase().split(/\s+/g).filter(Boolean)
      const source = sessionId
        ? database.memories.filter(memory => memory.sourceSessionId === sessionId)
        : database.memories

      return [...source]
        .map(memory => ({
          memory,
          score: scoreMemory(memory.summary, queryTerms),
        }))
        .filter(item => item.score > 0)
        .sort((left, right) => right.score - left.score || right.memory.createdAt.localeCompare(left.memory.createdAt))
        .slice(0, limit)
        .map(item => item.memory)
    },

    async rememberMessage(sessionId: string, role: ChatMessage['role'], content: string): Promise<MemoryEntry | null> {
      if (role !== 'user')
        return null

      const normalized = normalizeMemoryText(content)
      if (!normalized || !shouldRememberContent(normalized))
        return null

      const database = await readDatabase(dataPath)
      const existing = database.memories.find(memory => memory.sourceSessionId === sessionId && memory.summary === normalized)
      if (existing)
        return existing

      const entry: MemoryEntry = {
        id: crypto.randomUUID(),
        sourceSessionId: sessionId,
        summary: normalized,
        createdAt: new Date().toISOString(),
      }

      database.memories.push(entry)
      await writeDatabase(dataPath, database)
      return entry
    },
  }
}
