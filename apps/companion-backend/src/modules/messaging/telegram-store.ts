import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TelegramState {
  lastUpdateId: number
  lastInboundAt: string
}

export type TelegramDeliveryStatus = 'sent' | 'failed' | 'retry_scheduled' | 'retry_sent'

export interface TelegramDeliveryRecord {
  id: string
  createdAt: string
  updatedAt: string
  status: TelegramDeliveryStatus
  text: string
  chatId: string
  voiceUrl?: string
  ttsSent: boolean
  attempts: number
  maxAttempts: number
  nextRetryAt?: string
  lastError?: string
}

interface TelegramDatabase {
  state: TelegramState
  deliveries: TelegramDeliveryRecord[]
}

const DEFAULT_STATE: TelegramState = {
  lastUpdateId: 0,
  lastInboundAt: '',
}

async function readDatabase(dataPath: string): Promise<TelegramDatabase> {
  try {
    const raw = await readFile(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<TelegramDatabase & TelegramState>

    // NOTICE: Backward compatibility for older state-only storage shape.
    const state = parsed.state ?? {
      lastUpdateId: Number.isFinite(parsed.lastUpdateId) ? Number(parsed.lastUpdateId) : 0,
      lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : '',
    }

    return {
      state: {
        lastUpdateId: Number.isFinite(state.lastUpdateId) ? Number(state.lastUpdateId) : 0,
        lastInboundAt: typeof state.lastInboundAt === 'string' ? state.lastInboundAt : '',
      },
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
    }
  }
  catch {
    return {
      state: { ...DEFAULT_STATE },
      deliveries: [],
    }
  }
}

async function writeDatabase(dataPath: string, database: TelegramDatabase): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true })
  await writeFile(dataPath, JSON.stringify(database, null, 2), 'utf-8')
}

/**
 * Creates Telegram state store for tracking update offsets and delivery attempts.
 */
export function createTelegramStore(dataPath: string) {
  return {
    async getState(): Promise<TelegramState> {
      const database = await readDatabase(dataPath)
      return database.state
    },

    async setLastUpdateId(lastUpdateId: number): Promise<TelegramState> {
      const database = await readDatabase(dataPath)
      const nextState: TelegramState = {
        ...database.state,
        lastUpdateId,
        lastInboundAt: new Date().toISOString(),
      }

      await writeDatabase(dataPath, {
        ...database,
        state: nextState,
      })
      return nextState
    },

    async createDelivery(input: { text: string, chatId: string, voiceUrl?: string, maxAttempts: number }): Promise<TelegramDeliveryRecord> {
      const database = await readDatabase(dataPath)
      const now = new Date().toISOString()

      const delivery: TelegramDeliveryRecord = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        status: 'retry_scheduled',
        text: input.text,
        chatId: input.chatId,
        voiceUrl: input.voiceUrl,
        ttsSent: false,
        attempts: 0,
        maxAttempts: input.maxAttempts,
      }

      database.deliveries.push(delivery)
      await writeDatabase(dataPath, database)
      return delivery
    },

    async markDeliverySent(deliveryId: string, ttsSent: boolean, status: Extract<TelegramDeliveryStatus, 'sent' | 'retry_sent'>): Promise<TelegramDeliveryRecord | undefined> {
      const database = await readDatabase(dataPath)
      const delivery = database.deliveries.find(item => item.id === deliveryId)
      if (!delivery)
        return undefined

      delivery.status = status
      delivery.updatedAt = new Date().toISOString()
      delivery.attempts += 1
      delivery.ttsSent = ttsSent
      delivery.lastError = undefined
      delivery.nextRetryAt = undefined

      await writeDatabase(dataPath, database)
      return delivery
    },

    async markDeliveryFailed(deliveryId: string, error: string, nextRetryAt?: string): Promise<TelegramDeliveryRecord | undefined> {
      const database = await readDatabase(dataPath)
      const delivery = database.deliveries.find(item => item.id === deliveryId)
      if (!delivery)
        return undefined

      delivery.attempts += 1
      delivery.updatedAt = new Date().toISOString()
      delivery.lastError = error

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed'
        delivery.nextRetryAt = undefined
      }
      else {
        delivery.status = 'retry_scheduled'
        delivery.nextRetryAt = nextRetryAt
      }

      await writeDatabase(dataPath, database)
      return delivery
    },

    async listRecentDeliveries(limit: number): Promise<TelegramDeliveryRecord[]> {
      const database = await readDatabase(dataPath)
      return database.deliveries
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
    },

    async listRetryCandidates(nowIso: string, limit: number): Promise<TelegramDeliveryRecord[]> {
      const database = await readDatabase(dataPath)
      return database.deliveries
        .filter((delivery) => {
          if (delivery.status !== 'retry_scheduled')
            return false

          if (!delivery.nextRetryAt)
            return true

          return delivery.nextRetryAt <= nowIso
        })
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, limit)
    },
  }
}
