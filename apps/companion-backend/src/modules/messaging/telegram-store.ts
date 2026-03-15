import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface TelegramState {
  lastUpdateId: number
  lastInboundAt: string
}

const DEFAULT_STATE: TelegramState = {
  lastUpdateId: 0,
  lastInboundAt: '',
}

async function readState(dataPath: string): Promise<TelegramState> {
  try {
    const raw = await readFile(dataPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<TelegramState>

    return {
      lastUpdateId: Number.isFinite(parsed.lastUpdateId) ? Number(parsed.lastUpdateId) : 0,
      lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : '',
    }
  }
  catch {
    return { ...DEFAULT_STATE }
  }
}

async function writeState(dataPath: string, state: TelegramState): Promise<void> {
  await mkdir(dirname(dataPath), { recursive: true })
  await writeFile(dataPath, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Creates Telegram state store for tracking update offsets.
 */
export function createTelegramStore(dataPath: string) {
  return {
    async getState(): Promise<TelegramState> {
      return readState(dataPath)
    },

    async setLastUpdateId(lastUpdateId: number): Promise<TelegramState> {
      const previous = await readState(dataPath)
      const next: TelegramState = {
        ...previous,
        lastUpdateId,
        lastInboundAt: new Date().toISOString(),
      }

      await writeState(dataPath, next)
      return next
    },
  }
}
