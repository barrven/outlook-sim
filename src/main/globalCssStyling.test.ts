import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { THEME_TOKEN_NAMES } from '../shared/themes'

const stylesDir = join(__dirname, '../renderer/src/styles')
const sheets = Object.fromEntries(
  readdirSync(stylesDir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => [name, readFileSync(join(stylesDir, name), 'utf-8')])
)
// Every stylesheet the renderer loads, as one string.
const allCss = Object.values(sheets).join('\n')
const css = sheets['global.css']
const tokensCss = sheets['tokens.css']
const mainTsx = readFileSync(join(__dirname, '../renderer/src/main.tsx'), 'utf-8')

// Colors live in src/shared/themes.ts and reach the page as custom
// properties set at runtime (src/renderer/src/theme.ts). The stylesheets
// are checked here for the one thing that makes that work: they never
// state a color themselves.
describe('theme system: stylesheets', () => {
  it('loads the token, base and component sheets, in that order', () => {
    const order = ['tokens.css', 'base.css', 'global.css'].map((name) => mainTsx.indexOf('./styles/' + name))
    expect(order.every((index) => index > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(Object.keys(sheets).sort()).toEqual(['base.css', 'global.css', 'tokens.css'])
  })

  it('contains no color literal anywhere — no hex, rgb()/hsl() or color-mix()', () => {
    expect(allCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(allCss).not.toMatch(/\b(rgba?|hsla?|color-mix|oklch|oklab)\(/)
  })

  it('does not define any color token itself — those come only from the theme registry', () => {
    for (const token of THEME_TOKEN_NAMES) {
      expect(allCss, token + ' must not be declared in CSS').not.toMatch(new RegExp(token + '\\s*:'))
    }
  })

  it('only references custom properties that exist — a theme token or a shape token from tokens.css', () => {
    const shapeTokens = [...tokensCss.matchAll(/(--[a-z-]+)\s*:/g)].map((match) => match[1])
    const known = new Set<string>([...THEME_TOKEN_NAMES, ...shapeTokens])
    const used = new Set([...allCss.matchAll(/var\((--[a-z-]+)/g)].map((match) => match[1]))

    expect([...used].filter((name) => !known.has(name))).toEqual([])
  })

  it('defines the radius scale once, in tokens.css', () => {
    for (const token of ['--radius-sm', '--radius', '--radius-lg', '--radius-pill']) {
      expect(tokensCss).toMatch(new RegExp(token + ':\\s*\\d+px;'))
    }
  })

  it('every border-radius uses the radius scale, never a one-off value', () => {
    const declarations = allCss.match(/border-radius:\s*[^;]+;/g) ?? []

    expect(declarations.length).toBeGreaterThan(0)
    for (const declaration of declarations) {
      expect(declaration).toMatch(/border-radius:\s*var\(--radius(-sm|-lg|-pill)?\);/)
    }
  })

  it('every box-shadow uses a shadow token, the focus ring or the accent, never a literal color', () => {
    const declarations = allCss.match(/box-shadow:\s*[^;]+;/g) ?? []

    expect(declarations.length).toBeGreaterThan(0)
    for (const declaration of declarations) {
      expect(declaration).toMatch(/var\(--(shadow-(sm|md|lg)|focus-ring|accent)\)|:\s*none;/)
    }
  })

  it('the body-level panes are styled as floating cards in one shared rule', () => {
    const rule = css.match(/\.message-list-pane,\s*\.reading-pane,[^{]*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/border-radius:\s*var\(--radius-lg\);/)
    expect(rule![0]).toMatch(/box-shadow:\s*var\(--shadow-sm\);/)
    for (const pane of ['.calendar-view', '.settings-view', '.gp-view', '.tasks-panel']) {
      expect(rule![0]).toContain(pane)
    }
  })

  it('the flagged message-list indicator uses a semantic token', () => {
    expect(css).toMatch(/\.message-list-flag-btn\.flagged\s*{\s*color:\s*var\(--flag-border\);\s*}/)
  })

  it('the ribbon\'s enabled New Email/Delete actions use the primary/danger tokens, never a hardcoded color', () => {
    expect(css).toMatch(/\.ribbon-action-primary:not\(:disabled\)\s*{[^}]*color:\s*var\(--primary\);/)
    expect(css).toMatch(/\.ribbon-action-danger:not\(:disabled\)\s*{[^}]*color:\s*var\(--danger\);/)
  })

  it('a disabled ribbon action is visibly muted rather than looking identical to an enabled one', () => {
    expect(css).toMatch(/\.ribbon-action:disabled\s*{[^}]*color:\s*var\(--text-muted\);/)
  })

  it('Reading Pane Delete/Mark-as-(un)read/Flag each get a distinct semantic color, not the shared blue default', () => {
    expect(css).toMatch(/\.reading-pane-actions \.reading-pane-delete-btn\s*{[^}]*color:\s*var\(--danger\);/)
    expect(css).toMatch(/\.reading-pane-actions \.reading-pane-read-toggle\s*{[^}]*color:\s*var\(--text-muted\);/)
    expect(css).toMatch(/\.reading-pane-actions \.reading-pane-flag-toggle\s*{[^}]*color:\s*var\(--flag\);/)
  })
})

describe('office clock (045)', () => {
  it('AC1: the clock display text uses the near-black --text token, not the muted color', () => {
    const rule = css.match(/\.office-clock-time\s*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/color:\s*var\(--text\);/)
  })
})

describe('flagged-row styling (054)', () => {
  it('AC1: the flag icon button is visibly larger than its original 14px size', () => {
    const rule = css.match(/\.message-list-flag-btn\s*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/font-size:\s*20px;/)
  })

  it('AC2: a flagged row gets a distinct background, using the semantic --flag-bg token', () => {
    const rule = css.match(/\.message-list-item\.flagged\s*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/background:\s*var\(--flag-bg\);/)
  })

  it('AC3: .flagged is declared before .selected in source order, so .selected wins the cascade when a row is both', () => {
    const flaggedIndex = css.indexOf('.message-list-item.flagged')
    const selectedIndex = css.indexOf('.message-list-item.selected')

    expect(flaggedIndex).toBeGreaterThan(-1)
    expect(selectedIndex).toBeGreaterThan(-1)
    expect(flaggedIndex).toBeLessThan(selectedIndex)
  })
})
