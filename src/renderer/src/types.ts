export type ModuleId = 'mail' | 'calendar'

export interface NavModule {
  id: ModuleId
  label: string
}

export const NAV_MODULES: NavModule[] = [
  { id: 'mail', label: 'Mail' },
  { id: 'calendar', label: 'Calendar' }
]
