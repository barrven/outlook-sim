import { vi } from 'vitest'
import type { ClockState, Folder, MailMessage } from '../../../shared/data-types'
import { DEFAULT_GP_ADMIN } from '../../../shared/ghostPractice'

export const DEFAULT_MOCK_MESSAGE: MailMessage = {
  id: 'mock-message-id',
  folderId: 'inbox',
  previousFolderId: null,
  subject: '',
  body: '',
  fromName: '',
  fromEmail: '',
  toName: '',
  toEmail: '',
  cc: [],
  timestamp: 0,
  isRead: false,
  isFlagged: false,
  categories: [],
  attachments: []
}

export const DEFAULT_MOCK_FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', type: 'system', sortOrder: 0 },
  { id: 'drafts', name: 'Drafts', type: 'system', sortOrder: 1 },
  { id: 'sent', name: 'Sent Items', type: 'system', sortOrder: 2 },
  { id: 'deleted', name: 'Deleted Items', type: 'system', sortOrder: 3 }
]

export const DEFAULT_MOCK_CLOCK_STATE: ClockState = {
  anchorSimTime: 0,
  anchorRealTime: 0,
  running: false,
  speed: 1
}

export function createMockApi(): Window['api'] {
  return {
    app: {
      getVersion: vi.fn().mockResolvedValue('0.1.0')
    },
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
        create: vi.fn().mockResolvedValue(DEFAULT_MOCK_MESSAGE),
        update: vi.fn().mockResolvedValue(DEFAULT_MOCK_MESSAGE),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      calendarItems: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      tasks: {
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
      appearance: {
        get: vi.fn().mockResolvedValue({ colorScheme: 'default' }),
        set: vi.fn().mockResolvedValue(undefined)
      },
      identity: {
        get: vi.fn().mockResolvedValue({ displayName: '', jobTitle: '', fromEmail: '', reportsTo: '', department: '' }),
        set: vi.fn().mockResolvedValue(undefined)
      },
      personas: {
        get: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockResolvedValue(undefined)
      },
      clock: {
        get: vi.fn().mockResolvedValue(DEFAULT_MOCK_CLOCK_STATE),
        now: vi.fn().mockResolvedValue(0),
        start: vi.fn().mockResolvedValue({ ...DEFAULT_MOCK_CLOCK_STATE, running: true }),
        pause: vi.fn().mockResolvedValue(DEFAULT_MOCK_CLOCK_STATE),
        setSpeed: vi.fn().mockResolvedValue(DEFAULT_MOCK_CLOCK_STATE)
      }
    },
    gp: {
      matters: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      records: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      folders: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      documents: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      admin: {
        get: vi.fn().mockResolvedValue(DEFAULT_GP_ADMIN),
        set: vi.fn().mockResolvedValue(undefined)
      }
    },
    compose: {
      open: vi.fn().mockResolvedValue(undefined)
    },
    messagePopout: {
      open: vi.fn().mockResolvedValue(undefined)
    },
    calendarPopout: {
      open: vi.fn().mockResolvedValue(undefined)
    },
    attachmentPopout: {
      open: vi.fn().mockResolvedValue(undefined)
    },
    session: {
      startFreePlay: vi.fn().mockResolvedValue({ ok: true })
    },
    scenario: {
      pickPack: vi.fn().mockResolvedValue({ ok: false, canceled: true }),
      applyPack: vi.fn().mockResolvedValue({ ok: true }),
      savePack: vi.fn().mockResolvedValue({ ok: false, canceled: true })
    },
    personasFile: {
      pick: vi.fn().mockResolvedValue({ ok: false, canceled: true })
    },
    attachments: {
      pick: vi.fn().mockResolvedValue({ ok: false, canceled: true }),
      extractText: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(''),
      pathForFile: vi.fn().mockReturnValue('')
    },
    llm: {
      generate: vi.fn().mockResolvedValue({ ok: true, text: '' }),
      test: vi.fn().mockResolvedValue({ ok: true, text: '' }),
      personaReply: vi.fn().mockResolvedValue({ ok: true, replied: false }),
      retryUnsolicitedMail: vi.fn().mockResolvedValue({ ok: true, sent: false }),
      generatePersonas: vi.fn().mockResolvedValue({ ok: false, error: 'not mocked' })
    },
    onMessagesChanged: vi.fn().mockReturnValue(() => {}),
    onCalendarItemsChanged: vi.fn().mockReturnValue(() => {}),
    onPersonaReplyFailed: vi.fn().mockReturnValue(() => {}),
    onUnsolicitedMailFailed: vi.fn().mockReturnValue(() => {}),
    onReminderFired: vi.fn().mockReturnValue(() => {}),
    onAppearanceChanged: vi.fn().mockReturnValue(() => {})
  }
}
