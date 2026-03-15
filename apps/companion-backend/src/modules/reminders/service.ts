import type { createChatRuntime } from '../chat/service'
import type { createReminderStore, ReminderRecord } from './store'

interface ProcessDueResult {
  now: string
  processed: number
  delivered: number
  failed: number
  exhausted: number
}

/**
 * Creates reminder runtime service for scheduled proactive delivery attempts.
 */
export function createReminderRuntime(
  reminderStore: ReturnType<typeof createReminderStore>,
  chatRuntime: ReturnType<typeof createChatRuntime>,
) {
  return {
    async createReminder(input: { sessionId: string, message: string, dueAt: string, maxAttempts: number }) {
      return reminderStore.createReminder(input)
    },

    async getReminder(reminderId: string) {
      return reminderStore.getReminder(reminderId)
    },

    async listReminders(status?: ReminderRecord['status']) {
      return reminderStore.listReminders(status)
    },

    async listRecentDeliveries(limit = 20) {
      return reminderStore.listRecentDeliveries(limit)
    },

    async processDueReminders(limit = 20): Promise<ProcessDueResult> {
      const nowIso = new Date().toISOString()
      const due = await reminderStore.getDuePendingReminders(nowIso, limit)

      let delivered = 0
      let failed = 0
      let exhausted = 0

      for (const reminder of due) {
        try {
          await chatRuntime.addMessage({
            sessionId: reminder.sessionId,
            role: 'assistant',
            content: `⏰ Reminder: ${reminder.message}`,
          })

          await reminderStore.markDelivered(reminder.id)
          delivered += 1
        }
        catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown reminder delivery error.'
          const retryDelayMinutes = Math.min(60, (reminder.attempts + 1) * 5)
          const nextAttemptAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString()

          const updated = await reminderStore.markFailedAttempt(reminder.id, message, nextAttemptAt)
          failed += 1

          if (updated?.status === 'failed')
            exhausted += 1
        }
      }

      return {
        now: nowIso,
        processed: due.length,
        delivered,
        failed,
        exhausted,
      }
    },
  }
}
