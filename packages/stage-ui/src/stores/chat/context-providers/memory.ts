import type { ContextMessage } from '../../../types/chat'

import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'

const MEMORY_CONTEXT_ID = 'companion:memory'

export function createCompanionMemoryContext(memories: Array<{ summary: string }>): ContextMessage {
  const lines = memories
    .map(memory => memory.summary.replaceAll(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3)

  return {
    id: nanoid(),
    contextId: MEMORY_CONTEXT_ID,
    strategy: ContextUpdateStrategy.ReplaceSelf,
    text: lines.length > 0
      ? `Relevant long-term memory:\n${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
      : 'Relevant long-term memory: none',
    createdAt: Date.now(),
  }
}
