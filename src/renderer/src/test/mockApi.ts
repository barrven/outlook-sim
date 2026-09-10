import { vi } from 'vitest'
import type { Folder } from '../../../shared/data-types'

export const DEFAULT_MOCK_FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', sortOrder: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', sortOrder: 1 },
  { id: 'sent', name: 'Sent Items', type: 'system', sortOrder: 2 },
  { id: 'deleted', name: 'Deleted Items', type: 'system', sortOrder: 3 }
]

export function createMockApi(): Window['api'] {
  return {
    data: {
      folders: {
        list: vi.fn().mockResolvedValue(DEFAULT_MOCK_FOLDERS),
        create: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      messages: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      calendarItems: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      settings: {
        get: vi
          .fn()
          .mockResolvedValue({ provider: 'openai', model: '', apiKeys: { openai: '', anthropic: '', gemini: '', xai: '' } }),
        set: vi.fn().mockResolvedValue(undefined)
      },
      systemPrompt: {
        get: vi.fn().mockResolvedValue({ systemPrompt: '' }),
        set: vi.fn().mockResolvedValue(undefined)
      },
      identity: {
        get: vi.fn().mockResolvedValue({ displayName: '', jobTitle: '', fromEmail: '' }),
        set: vi.fn().mockResolvedValue(undefined)
      },
      personas: {
        get: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockResolvedValue(undefined)
      }
    },
    compose: {
      open: vi.fn().mockResolvedValue(undefined)
    },
    onMessagesChanged: vi.fn().mockReturnValue(() => {})
  }
}
