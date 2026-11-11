import { DEFAULT_THEME_ID, getTheme, themeTokens, type ColorScheme } from '../../shared/themes'

const STORAGE_KEY = 'outlook-sim.theme'

// Applies a theme to this window: every color token becomes a custom
// property on <html>, `data-theme` names the theme for anything that wants
// to key off it, and `color-scheme` makes native controls (scrollbars,
// date pickers, select menus) follow light/dark too.
//
// The id is also remembered in localStorage — purely as a cache, the
// config file stays the source of truth — so the next window to open can
// paint in the right theme immediately instead of flashing the default
// while it waits for the config to load.
export function applyTheme(id: unknown): ColorScheme {
  const theme = getTheme(id)
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeTokens(theme))) {
    root.style.setProperty(name, value)
  }
  root.dataset.theme = theme.id
  root.dataset.themeMode = theme.mode
  root.style.colorScheme = theme.mode
  try {
    window.localStorage.setItem(STORAGE_KEY, theme.id)
  } catch {
    // Storage can be unavailable; the theme is still applied.
  }
  return theme.id as ColorScheme
}

export function applyCachedTheme(): ColorScheme {
  let cached: string | null = null
  try {
    cached = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Fall through to the default.
  }
  return applyTheme(cached ?? DEFAULT_THEME_ID)
}
