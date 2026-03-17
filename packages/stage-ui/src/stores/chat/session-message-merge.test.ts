import { describe, expect, it } from 'vitest'

import { mergeLoadedSessionMessages } from './session-message-merge'

describe('mergeLoadedSessionMessages', () => {
  it('keeps chronological ordering when appending unsaved current messages', () => {
    const stored = [
      { id: 's1', role: 'system', content: 'sys', createdAt: 1 },
      { id: 'u1', role: 'user', content: 'hello', createdAt: 2 },
    ] as any

    const current = [
      { id: 's1', role: 'system', content: 'sys', createdAt: 1 },
      { id: 'a1', role: 'assistant', content: 'hey', createdAt: 3 },
      { id: 'u2', role: 'user', content: 'later', createdAt: 4 },
    ] as any

    const merged = mergeLoadedSessionMessages(stored, current)
    expect(merged.map(message => message.id)).toEqual(['s1', 'u1', 'a1', 'u2'])
  })
})
