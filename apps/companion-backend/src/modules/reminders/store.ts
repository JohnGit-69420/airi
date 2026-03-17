import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type ReminderStatus = 'pending' | 'delivered' | 'failed' | 'cancelled'
export type ReminderDeliveryStatus = 'delivered' | 'failed'

export interface ReminderRecord {
  id: string
  sessionId: string
  message: string
  dueAt: string
  status: ReminderStatus
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
  nextAttemptAt?: string
  lastError?: string
}

export interface ReminderDeliveryRecord {
  id: string
  reminderId: string
  status: ReminderDeliveryStatus
  attemptedAt: string
  error?: string
}

interface ReminderDatabase {
  reminders: ReminderRecord[]
  deliveries: ReminderDeliveryRecord[]
}

const EMPTY_DB: ReminderDatabase = {
  reminders: [],
  deliveries: [],
}

/**
 * Reads reminders JSON data from disk if present, otherwise returns empty defaults.
 */
async function readDatabase(dataPath: string): Promise<ReminderDatabase> {
  try {
    const raw = await readFile(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ReminderDatabase>

    return {
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
    }
  }
  catch {
    return { ...EMPTY_DB }
  }
}

/**
 * Persists reminders JSON data for single-process local backend development.
 */
async function writeDatabase(dataPath: string, database: ReminderDatabase): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true })
  await writeFile(dataPath, JSON.stringify(database, null, 2), 'utf-8')
}

/**
 * Creates reminder store for persistence and delivery attempt tracking.
 */
export function createReminderStore(dataPath: string) {
  return {
    async createReminder(input: { sessionId: string, message: string, dueAt: string, maxAttempts: number }): Promise<ReminderRecord> {
      const database = await readDatabase(dataPath)
      const now = new Date().toISOString()

      const reminder: ReminderRecord = {
        id: crypto.randomUUID(),
        sessionId: input.sessionId,
        message: input.message,
        dueAt: input.dueAt,
        status: 'pending',
        attempts: 0,
        maxAttempts: input.maxAttempts,
        createdAt: now,
        updatedAt: now,
      }

      database.reminders.push(reminder)
      await writeDatabase(dataPath, database)
      return reminder
    },

    async getReminder(reminderId: string): Promise<ReminderRecord | undefined> {
      const database = await readDatabase(dataPath)
      return database.reminders.find(reminder => reminder.id === reminderId)
    },

    async listReminders(status?: ReminderStatus): Promise<ReminderRecord[]> {
      const database = await readDatabase(dataPath)
      const reminders = status
        ? database.reminders.filter(reminder => reminder.status === status)
        : database.reminders

      return reminders.sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    },

    async getDuePendingReminders(nowIso: string, limit: number): Promise<ReminderRecord[]> {
      const database = await readDatabase(dataPath)

      return database.reminders
        .filter((reminder) => {
          if (reminder.status !== 'pending')
            return false

          if (reminder.dueAt > nowIso)
            return false

          if (reminder.nextAttemptAt && reminder.nextAttemptAt > nowIso)
            return false

          return true
        })
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, limit)
    },

    async markDelivered(reminderId: string): Promise<ReminderRecord | undefined> {
      const database = await readDatabase(dataPath)
      const reminder = database.reminders.find(candidate => candidate.id === reminderId)
      if (!reminder)
        return undefined

      reminder.status = 'delivered'
      reminder.updatedAt = new Date().toISOString()
      reminder.nextAttemptAt = undefined
      reminder.lastError = undefined

      database.deliveries.push({
        id: crypto.randomUUID(),
        reminderId,
        status: 'delivered',
        attemptedAt: reminder.updatedAt,
      })

      await writeDatabase(dataPath, database)
      return reminder
    },

    async markFailedAttempt(reminderId: string, error: string, nextAttemptAt: string): Promise<ReminderRecord | undefined> {
      const database = await readDatabase(dataPath)
      const reminder = database.reminders.find(candidate => candidate.id === reminderId)
      if (!reminder)
        return undefined

      reminder.attempts += 1
      reminder.updatedAt = new Date().toISOString()
      reminder.lastError = error

      if (reminder.attempts >= reminder.maxAttempts) {
        reminder.status = 'failed'
        reminder.nextAttemptAt = undefined
      }
      else {
        reminder.status = 'pending'
        reminder.nextAttemptAt = nextAttemptAt
      }

      database.deliveries.push({
        id: crypto.randomUUID(),
        reminderId,
        status: 'failed',
        attemptedAt: reminder.updatedAt,
        error,
      })

      await writeDatabase(dataPath, database)
      return reminder
    },

    async listRecentDeliveries(limit: number): Promise<ReminderDeliveryRecord[]> {
      const database = await readDatabase(dataPath)
      return database.deliveries
        .slice()
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        .slice(0, limit)
    },
  }
}
