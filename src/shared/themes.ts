// The app's theme system. This file is the single source of truth for
// every color the UI uses.
//
// A theme is a handful of *seed* colors (THEMES below). Everything else —
// borders, hover and selection fills, banner tints, shadows — is derived
// from those seeds by `themeTokens`, and applied to a window as CSS custom
// properties by the renderer's `applyTheme`. The stylesheets contain no
// color literals at all; they only ever reference the tokens.
//
// To add a theme: add one entry to THEMES. Settings, the View-tab picker,
// config validation and the contrast tests all read this list.

export type ThemeMode = 'light' | 'dark'

export interface ThemeSeeds {
  // The window background that the panes float on (ribbon, folder rail).
  canvas: string
  // Content panes: message list, reading pane, calendar, settings.
  surface: string
  text: string
  textMuted: string
  // The theme's identity hue: selection, links, primary buttons.
  accent: string
  // Text on an accent-filled button.
  onAccent: string
  // Destructive actions and error text; also used as a button fill.
  danger: string
  onDanger: string
  // Reminder/caution banners.
  warning: string
  success: string
  // The Flag action's own amber, distinct from `warning`.
  flag: string
}

export interface ThemeDefinition {
  id: string
  label: string
  mode: ThemeMode
  seeds: ThemeSeeds
}

export const THEMES = [
  {
    id: 'default',
    label: 'Azure',
    mode: 'light',
    seeds: {
      canvas: '#edf1f9',
      surface: '#ffffff',
      text: '#111827',
      textMuted: '#556178',
      accent: '#1d55d4',
      onAccent: '#ffffff',
      danger: '#b81f30',
      onDanger: '#ffffff',
      warning: '#d99a00',
      success: '#117035',
      flag: '#b45309'
    }
  },
  {
    id: 'sage',
    label: 'Sage',
    mode: 'light',
    seeds: {
      canvas: '#eaf2ec',
      surface: '#ffffff',
      text: '#12241a',
      textMuted: '#4c6355',
      accent: '#196f43',
      onAccent: '#ffffff',
      danger: '#b81f30',
      onDanger: '#ffffff',
      warning: '#d99a00',
      success: '#117035',
      flag: '#b45309'
    }
  },
  {
    id: 'plum',
    label: 'Plum',
    mode: 'light',
    seeds: {
      canvas: '#f2edf8',
      surface: '#ffffff',
      text: '#22142e',
      textMuted: '#635275',
      accent: '#6c2bd9',
      onAccent: '#ffffff',
      danger: '#b81f30',
      onDanger: '#ffffff',
      warning: '#d99a00',
      success: '#117035',
      flag: '#b45309'
    }
  },
  {
    id: 'sand',
    label: 'Sand',
    mode: 'light',
    seeds: {
      canvas: '#f4eee4',
      surface: '#fffdf8',
      text: '#2a2017',
      textMuted: '#685a49',
      accent: '#9c460b',
      onAccent: '#ffffff',
      danger: '#b81f30',
      onDanger: '#ffffff',
      warning: '#d99a00',
      success: '#117035',
      flag: '#a8500a'
    }
  },
  {
    id: 'dark',
    label: 'Graphite',
    mode: 'dark',
    seeds: {
      canvas: '#0e1014',
      surface: '#181b21',
      text: '#e7eaf0',
      textMuted: '#9ba5b6',
      accent: '#6ea8fe',
      onAccent: '#08111f',
      danger: '#ff6b6b',
      onDanger: '#240606',
      warning: '#f5c542',
      success: '#4ade80',
      flag: '#f0a43a'
    }
  },
  {
    id: 'midnight',
    label: 'Midnight',
    mode: 'dark',
    seeds: {
      canvas: '#0a0f1f',
      surface: '#131a2e',
      text: '#e5e9f8',
      textMuted: '#9aa4c6',
      accent: '#a78bfa',
      onAccent: '#140b2c',
      danger: '#fb7185',
      onDanger: '#2a0610',
      warning: '#fbbf24',
      success: '#34d399',
      flag: '#f5a524'
    }
  }
] as const satisfies readonly ThemeDefinition[]

export type ColorScheme = (typeof THEMES)[number]['id']

export const DEFAULT_THEME_ID: ColorScheme = 'default'

export function isColorScheme(value: unknown): value is ColorScheme {
  return THEMES.some((theme) => theme.id === value)
}

// Anything that isn't a known theme id (a hand-edited config file, a theme
// removed in a later version) falls back to the default rather than
// leaving the window unstyled.
export function getTheme(id: unknown): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

// --- Color maths -------------------------------------------------------------

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? [...clean].map((char) => char + char).join('') : clean
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

// `amount` (0–1) of `color` blended into `base` — a 0.1 mix is mostly base.
export function mix(color: string, base: string, amount: number): string {
  const a = hexToRgb(color)
  const b = hexToRgb(base)
  return rgbToHex([0, 1, 2].map((index) => a[index] * amount + b[index] * (1 - amount)) as Rgb)
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// WCAG 2.1 relative luminance and contrast ratio.
export function relativeLuminance(hex: string): number {
  const channel = (value: number): number => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA)
  const b = relativeLuminance(hexB)
  const [lighter, darker] = a >= b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

// --- Derived tokens ------------------------------------------------------------

// Every color custom property the stylesheets may reference. `themeTokens`
// returns exactly these keys for every theme, so switching themes can never
// leave one undefined.
export const THEME_TOKEN_NAMES = [
  '--canvas',
  '--pane-bg',
  '--surface-raised',
  '--ribbon-bg',
  '--nav-rail-bg',
  '--border',
  '--border-strong',
  '--text',
  '--text-muted',
  '--accent',
  '--accent-soft',
  '--hover-bg',
  '--selected-bg',
  '--selected-border',
  '--primary',
  '--primary-bg',
  '--primary-border',
  '--primary-hover',
  '--danger',
  '--danger-bg',
  '--danger-border',
  '--warning',
  '--warning-bg',
  '--warning-border',
  '--success',
  '--flag',
  '--flag-bg',
  '--flag-border',
  '--focus-ring',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg'
] as const

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number]

export function themeTokens(theme: ThemeDefinition): Record<ThemeTokenName, string> {
  const { seeds, mode } = theme
  const dark = mode === 'dark'
  // Shadows need far more opacity to read at all on a dark canvas.
  const shadow = (light: number, darkAlpha: number): string => `rgba(0, 0, 0, ${dark ? darkAlpha : light})`

  return {
    '--canvas': seeds.canvas,
    '--pane-bg': seeds.surface,
    // Menus and dialogs: lifted off the pane by a shadow in light themes,
    // and by a slightly lighter fill in dark ones (where shadows vanish).
    '--surface-raised': dark ? mix(seeds.text, seeds.surface, 0.07) : seeds.surface,
    '--ribbon-bg': seeds.canvas,
    '--nav-rail-bg': seeds.canvas,
    '--border': mix(seeds.text, seeds.surface, dark ? 0.16 : 0.12),
    '--border-strong': mix(seeds.text, seeds.surface, dark ? 0.3 : 0.24),
    '--text': seeds.text,
    '--text-muted': seeds.textMuted,
    '--accent': seeds.accent,
    '--accent-soft': mix(seeds.accent, seeds.surface, 0.1),
    '--hover-bg': mix(seeds.accent, seeds.surface, dark ? 0.1 : 0.07),
    '--selected-bg': mix(seeds.accent, seeds.surface, dark ? 0.2 : 0.13),
    '--selected-border': mix(seeds.accent, seeds.surface, 0.5),
    '--primary': seeds.onAccent,
    '--primary-bg': seeds.accent,
    '--primary-border': seeds.accent,
    '--primary-hover': mix(seeds.text, seeds.accent, 0.14),
    '--danger': seeds.onDanger,
    '--danger-bg': seeds.danger,
    '--danger-border': seeds.danger,
    '--warning': seeds.text,
    '--warning-bg': mix(seeds.warning, seeds.surface, dark ? 0.2 : 0.22),
    '--warning-border': seeds.warning,
    '--success': seeds.success,
    '--flag': mix(seeds.flag, seeds.text, 0.55),
    '--flag-bg': mix(seeds.flag, seeds.surface, dark ? 0.16 : 0.13),
    '--flag-border': seeds.flag,
    '--focus-ring': withAlpha(seeds.accent, 0.55),
    '--shadow-sm': `0 1px 2px ${shadow(0.06, 0.4)}`,
    '--shadow-md': `0 4px 12px ${shadow(0.1, 0.5)}`,
    '--shadow-lg': `0 12px 32px ${shadow(0.18, 0.6)}`
  }
}
