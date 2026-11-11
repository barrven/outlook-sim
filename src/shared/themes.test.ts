import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  DEFAULT_THEME_ID,
  getTheme,
  isColorScheme,
  mix,
  relativeLuminance,
  THEME_TOKEN_NAMES,
  themeTokens,
  THEMES
} from './themes'

// WCAG AA for normal-size text.
const AA = 4.5
// WCAG's bar for non-text marks (icons, borders that carry meaning).
const NON_TEXT = 3

describe('theme registry', () => {
  it('has unique ids and labels, with the default theme first', () => {
    const ids = THEMES.map((theme) => theme.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(THEMES.map((theme) => theme.label)).size).toBe(THEMES.length)
    expect(ids[0]).toBe(DEFAULT_THEME_ID)
  })

  it('keeps the four original scheme ids, so a saved choice from an earlier version still loads', () => {
    for (const id of ['default', 'sage', 'plum', 'dark']) {
      expect(isColorScheme(id)).toBe(true)
    }
  })

  it('offers both light and dark themes', () => {
    expect(THEMES.filter((theme) => theme.mode === 'light').length).toBeGreaterThanOrEqual(2)
    expect(THEMES.filter((theme) => theme.mode === 'dark').length).toBeGreaterThanOrEqual(2)
  })

  it('falls back to the default theme for an unknown or malformed id', () => {
    expect(getTheme('plum').id).toBe('plum')
    expect(getTheme('no-such-theme').id).toBe(DEFAULT_THEME_ID)
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID)
    expect(isColorScheme('no-such-theme')).toBe(false)
    expect(isColorScheme(42)).toBe(false)
  })

  it('gives every theme its own accent, so no two look alike', () => {
    const accents = THEMES.map((theme) => theme.seeds.accent)
    expect(new Set(accents).size).toBe(accents.length)
  })
})

describe('mix', () => {
  it('blends the given share of the first color into the second', () => {
    expect(mix('#ffffff', '#000000', 0)).toBe('#000000')
    expect(mix('#ffffff', '#000000', 1)).toBe('#ffffff')
    expect(mix('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(mix('#f00', '#0000ff', 0.5)).toBe('#800080')
  })
})

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('theme "%s"', (_id, theme) => {
  const tokens = themeTokens(theme)
  const { seeds } = theme

  it('defines every token the stylesheets reference, and nothing else', () => {
    expect(Object.keys(tokens).sort()).toEqual([...THEME_TOKEN_NAMES].sort())
    for (const value of Object.values(tokens)) expect(value).not.toBe('')
  })

  it('is actually light or dark, as labelled', () => {
    const surfaces = [seeds.canvas, seeds.surface].map(relativeLuminance)
    if (theme.mode === 'dark') {
      for (const luminance of surfaces) expect(luminance).toBeLessThan(0.1)
    } else {
      for (const luminance of surfaces) expect(luminance).toBeGreaterThan(0.7)
    }
  })

  it('text and muted text are readable on the panes, the canvas, and raised menus', () => {
    for (const background of [tokens['--pane-bg'], tokens['--canvas'], tokens['--surface-raised']]) {
      expect(contrastRatio(tokens['--text'], background)).toBeGreaterThanOrEqual(AA)
      expect(contrastRatio(tokens['--text-muted'], background)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('text stays readable on hovered, selected and flagged rows and on banners', () => {
    for (const background of [
      tokens['--hover-bg'],
      tokens['--selected-bg'],
      tokens['--flag-bg'],
      tokens['--accent-soft']
    ]) {
      expect(contrastRatio(tokens['--text'], background)).toBeGreaterThanOrEqual(AA)
      expect(contrastRatio(tokens['--text-muted'], background)).toBeGreaterThanOrEqual(AA)
    }
    expect(contrastRatio(tokens['--warning'], tokens['--warning-bg'])).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(tokens['--flag'], tokens['--flag-bg'])).toBeGreaterThanOrEqual(AA)
  })

  it('the accent reads as text on panes, canvas and selected rows', () => {
    for (const background of [tokens['--pane-bg'], tokens['--canvas'], tokens['--selected-bg']]) {
      expect(contrastRatio(tokens['--accent'], background)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('filled buttons have readable labels, in their normal and hovered states', () => {
    expect(contrastRatio(tokens['--primary'], tokens['--primary-bg'])).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(tokens['--primary'], tokens['--primary-hover'])).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio(tokens['--danger'], tokens['--danger-bg'])).toBeGreaterThanOrEqual(AA)
  })

  it('status colors used as standalone text or icons stand out from the surfaces they sit on', () => {
    for (const background of [tokens['--pane-bg'], tokens['--canvas']]) {
      expect(contrastRatio(tokens['--danger-border'], background)).toBeGreaterThanOrEqual(AA)
      expect(contrastRatio(tokens['--success'], background)).toBeGreaterThanOrEqual(AA)
      expect(contrastRatio(tokens['--flag-border'], background)).toBeGreaterThanOrEqual(NON_TEXT)
    }
  })

  it('the selection fill is visibly different from a plain pane', () => {
    expect(contrastRatio(tokens['--selected-bg'], tokens['--pane-bg'])).toBeGreaterThan(1.12)
    expect(tokens['--selected-bg']).not.toBe(tokens['--hover-bg'])
  })
})
