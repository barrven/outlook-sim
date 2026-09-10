export type ModuleId = 'mail' | 'calendar'

export interface NavModule {
  id: ModuleId
  label: string
}

export const NAV_MODULES: NavModule[] = [
  { id: 'mail', label: 'Mail' },
  { id: 'calendar', label: 'Calendar' }
]

export interface MailFolder {
  id: string
  label: string
}

export const MAIL_FOLDERS: MailFolder[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'sent', label: 'Sent Items' },
  { id: 'deleted', label: 'Deleted Items' }
]
