import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { ChatMessage } from '../chat/store'

export interface MemoryEntry {
  id: string
  sourceSessionId: string
  summary: string
  createdAt: string
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

/**
 * Creates memory persistence store with summary-based retrieval.
 */
export function createMemoryStore(dataPath: string) {
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
  }
}
