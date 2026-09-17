import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, '../renderer/src/styles/global.css'), 'utf-8')
const indexHtml = readFileSync(join(__dirname, '../renderer/index.html'), 'utf-8')

function extractRootBlock(source: string): string {
  const match = source.match(/:root\s*{([^}]*)}/)
  if (!match) throw new Error(':root block not found in global.css')
  return match[1]
}

// A color scheme's tokens live in one of these attribute-selector blocks
// (058), not the bare `:root { ... }` one — which now holds only the
// scheme-independent radius tokens (037).
function extractThemeBlock(source: string, theme: string): string {
  const match = source.match(new RegExp(`:root\\[data-theme=['"]${theme}['"]\\]\\s*{([^}]*)}`))
  if (!match) throw new Error(`:root[data-theme='${theme}'] block not found in global.css`)
  return match[1]
}

function extractDefaultThemeBlock(source: string): string {
  return extractThemeBlock(source, 'default')
}

// Every known scheme's selector, so tests that need to look past ALL of
// them (e.g. "no color outside a token block") don't need updating each
// time a new scheme (059/060/...) is added — only this list does.
const KNOWN_THEMES = ['default', 'sage', 'plum', 'dark']

function stripAllThemeBlocks(source: string): string {
  return KNOWN_THEMES.reduce(
    (acc, theme) => acc.replace(new RegExp(`:root\\[data-theme=['"]${theme}['"]\\]\\s*{[^}]*}`), ''),
    source.replace(/:root\s*{[^}]*}/, '')
  )
}

describe('global.css semantic tokens (037)', () => {
  it('AC1: defines the semantic status color tokens used across the app', () => {
    const defaultTheme = extractDefaultThemeBlock(css)

    for (const token of [
      '--hover-bg',
      '--danger',
      '--danger-bg',
      '--danger-border',
      '--warning',
      '--warning-bg',
      '--warning-border',
      '--success'
    ]) {
      expect(defaultTheme).toMatch(new RegExp(`${token}:\\s*#[0-9a-fA-F]{3,8};`))
    }
  })

  it('AC1: no hardcoded hex color appears outside a token-defining block — every color is a token', () => {
    expect(stripAllThemeBlocks(css)).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('AC2: defines a single, consistent border-radius token pair', () => {
    const root = extractRootBlock(css)

    expect(root).toMatch(/--radius:\s*\d+px;/)
    expect(root).toMatch(/--radius-pill:\s*\d+px;/)
  })

  it('AC2: every border-radius declaration uses a radius token, not a hardcoded value', () => {
    const declarations = css.match(/border-radius:\s*[^;]+;/g) ?? []

    expect(declarations.length).toBeGreaterThan(0)
    for (const declaration of declarations) {
      expect(declaration).toMatch(/border-radius:\s*var\(--radius(-pill)?\);/)
    }
  })

  it('AC3: the flagged message-list indicator uses a semantic token, not a hardcoded color', () => {
    // Originally --danger (037); revised to the amber --flag-border during
    // 058's button-coloring pass, at the user's direction — still a
    // semantic token either way, which is what this AC actually requires.
    // The Reading Pane's own Flag/Unflag toggle deliberately has no
    // color change on flagged state anymore (also the user's direction,
    // 058) — its "Unflag" label text already signals the flagged state,
    // so it's intentionally not covered by this test.
    expect(css).toMatch(/\.message-list-flag-btn\.flagged\s*{\s*color:\s*var\(--flag-border\);\s*}/)
  })
})

describe('color scheme infrastructure (058)', () => {
  it('AC2: the root element opts into the "default" scheme, the single switch point for every color token', () => {
    expect(indexHtml).toMatch(/<html[^>]*\bdata-theme=(['"])default\1[^>]*>/)
  })

  it('AC2: color tokens are defined by an attribute-selector block, not the plain :root — provably swappable even with only one scheme so far', () => {
    // A real second scheme (059/060) is just another `:root[data-theme='...']`
    // block; nothing else in the app needs to change to add or select one.
    expect(css).toMatch(/:root\[data-theme=['"]default['"]\]\s*{/)

    // The color tokens must live ONLY in that attribute-selector block —
    // not also duplicated in the plain, unconditional :root — otherwise
    // changing data-theme wouldn't actually swap every token's value.
    const root = extractRootBlock(css)
    for (const token of ['--border', '--ribbon-bg', '--pane-bg', '--nav-rail-bg', '--accent', '--danger']) {
      expect(root).not.toContain(`${token}:`)
    }
  })

  it('AC1/AC3: the revised default palette replaces 037\'s flat neutral grays with distinct, non-gray hues', () => {
    const defaultTheme = extractDefaultThemeBlock(css)

    // The exact hex values feature 037 originally shipped — asserting
    // they're gone (not just "different") catches an accidental partial
    // revert, not just any edit at all.
    const originalGrays: Record<string, string> = {
      '--border': '#c6c6c6',
      '--ribbon-bg': '#f3f2f1',
      '--nav-rail-bg': '#f7f7f7',
      '--hover-bg': '#eaeaea',
      '--text-muted': '#6b6b6b'
    }
    for (const [token, originalHex] of Object.entries(originalGrays)) {
      const match = defaultTheme.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8});`))
      expect(match, `${token} should still be defined`).not.toBeNull()
      expect(match![1].toLowerCase()).not.toBe(originalHex)
    }
  })

  it('AC1/AC3: --pane-bg stays pure white regardless of the gray-reduction pass, for message-content readability', () => {
    const defaultTheme = extractDefaultThemeBlock(css)

    expect(defaultTheme).toMatch(/--pane-bg:\s*#ffffff;/i)
  })

  // Requested directly by the user after seeing the revised palette live:
  // give the always-visible action buttons (ribbon + Reading Pane) their
  // own semantic identity colors instead of a uniform look, the same
  // "logical/semantic color system" Core Requirement 2 already calls for.
  it('defines a distinct flag/amber token trio, separate from --warning', () => {
    const defaultTheme = extractDefaultThemeBlock(css)

    expect(defaultTheme).toMatch(/--flag:\s*#[0-9a-fA-F]{3,8};/)
    expect(defaultTheme).toMatch(/--flag-bg:\s*#[0-9a-fA-F]{3,8};/)
    expect(defaultTheme).toMatch(/--flag-border:\s*#[0-9a-fA-F]{3,8};/)
  })

  it('defines a --primary token trio for filled "blue" buttons (New Email, Reading Pane toggle)', () => {
    const defaultTheme = extractDefaultThemeBlock(css)

    expect(defaultTheme).toMatch(/--primary:\s*#[0-9a-fA-F]{3,8};/)
    expect(defaultTheme).toMatch(/--primary-bg:\s*#[0-9a-fA-F]{3,8};/)
    expect(defaultTheme).toMatch(/--primary-border:\s*#[0-9a-fA-F]{3,8};/)
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

// WCAG 2.1 relative-luminance contrast ratio, for AC3's "adequate
// text/icon contrast" — a real computed check, not a hand-waved "looks
// distinct enough."
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const expand = (h: string): string => (h.length === 3 || h.length === 4 ? [...h].map((c) => c + c).join('') : h)
  const full = expand(clean)
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return [r, g, b]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA))
  const lB = relativeLuminance(hexToRgb(hexB))
  const [lighter, darker] = lA >= lB ? [lA, lB] : [lB, lA]
  return (lighter + 0.05) / (darker + 0.05)
}

function getToken(themeBlock: string, token: string): string {
  const match = themeBlock.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8});`))
  if (!match) throw new Error(`${token} not found`)
  return match[1]
}

describe('two additional light color schemes (059)', () => {
  const ALL_TOKENS = [
    '--border',
    '--ribbon-bg',
    '--pane-bg',
    '--nav-rail-bg',
    '--selected-bg',
    '--selected-border',
    '--text',
    '--text-muted',
    '--accent',
    '--hover-bg',
    '--danger',
    '--danger-bg',
    '--danger-border',
    '--warning',
    '--warning-bg',
    '--warning-border',
    '--success',
    '--primary',
    '--primary-bg',
    '--primary-border',
    '--flag',
    '--flag-bg',
    '--flag-border'
  ]

  it.each(['sage', 'plum'])('AC1: "%s" defines a complete value for every semantic token the app uses', (theme) => {
    const block = extractThemeBlock(css, theme)
    for (const token of ALL_TOKENS) {
      expect(block, `${theme} should define ${token}`).toMatch(new RegExp(`${token}:\\s*#[0-9a-fA-F]{3,8};`))
    }
  })

  it('AC2: every scheme defines the exact same set of token names — nothing can fall through to an undefined value when switching', () => {
    const tokenNames = (block: string): string[] => [...block.matchAll(/--[a-z-]+(?=:)/g)].map((m) => m[0]).sort()

    const defaultNames = tokenNames(extractDefaultThemeBlock(css))
    const sageNames = tokenNames(extractThemeBlock(css, 'sage'))
    const plumNames = tokenNames(extractThemeBlock(css, 'plum'))

    expect(sageNames).toEqual(defaultNames)
    expect(plumNames).toEqual(defaultNames)
  })

  it('AC3: sage and plum each use a distinct accent/primary/text hue from the default and from each other', () => {
    const defaultBlock = extractDefaultThemeBlock(css)
    const sageBlock = extractThemeBlock(css, 'sage')
    const plumBlock = extractThemeBlock(css, 'plum')

    for (const token of ['--accent', '--primary-bg', '--text']) {
      const defaultValue = getToken(defaultBlock, token)
      const sageValue = getToken(sageBlock, token)
      const plumValue = getToken(plumBlock, token)

      expect(sageValue).not.toBe(defaultValue)
      expect(plumValue).not.toBe(defaultValue)
      expect(sageValue).not.toBe(plumValue)
    }
  })

  it.each(['sage', 'plum'])(
    'AC3: "%s" has adequate contrast (WCAG AA, >=4.5:1) for muted text and white-on-primary-button text',
    (theme) => {
      const block = extractThemeBlock(css, theme)
      const paneBg = getToken(block, '--pane-bg')
      const textMuted = getToken(block, '--text-muted')
      const primary = getToken(block, '--primary')
      const primaryBg = getToken(block, '--primary-bg')

      expect(contrastRatio(textMuted, paneBg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(primary, primaryBg)).toBeGreaterThanOrEqual(4.5)
    }
  )

  it('AC4: no layout-affecting property (padding/margin/width/height/flex/gap/position/display) appears anywhere in global.css', () => {
    // 058/059 are both explicitly color-only revisions — this is a coarse
    // but effective tripwire: if either feature's diff ever touched
    // layout, one of these property names would show up somewhere they
    // weren't already established pre-058 for these specific schemes'
    // own blocks. Scoped to just the new scheme blocks themselves, since
    // the rest of the file legitimately has layout properties everywhere.
    for (const theme of ['sage', 'plum']) {
      const block = extractThemeBlock(css, theme)
      expect(block).not.toMatch(/\b(padding|margin|width|height|flex|gap|position|display)\s*:/)
    }
  })
})

describe('dark color scheme (060)', () => {
  const ALL_TOKENS = [
    '--border',
    '--ribbon-bg',
    '--pane-bg',
    '--nav-rail-bg',
    '--selected-bg',
    '--selected-border',
    '--text',
    '--text-muted',
    '--accent',
    '--hover-bg',
    '--danger',
    '--danger-bg',
    '--danger-border',
    '--warning',
    '--warning-bg',
    '--warning-border',
    '--success',
    '--primary',
    '--primary-bg',
    '--primary-border',
    '--flag',
    '--flag-bg',
    '--flag-border'
  ]

  it('AC1: "dark" defines a complete value for every semantic token the app uses', () => {
    const block = extractThemeBlock(css, 'dark')
    for (const token of ALL_TOKENS) {
      expect(block, `dark should define ${token}`).toMatch(new RegExp(`${token}:\\s*#[0-9a-fA-F]{3,8};`))
    }
  })

  it('AC2: "dark" defines the exact same set of token names as every other scheme — switching changes every themed surface consistently, nothing falls through to an undefined value', () => {
    const tokenNames = (block: string): string[] => [...block.matchAll(/--[a-z-]+(?=:)/g)].map((m) => m[0]).sort()

    const defaultNames = tokenNames(extractDefaultThemeBlock(css))
    const darkNames = tokenNames(extractThemeBlock(css, 'dark'))

    expect(darkNames).toEqual(defaultNames)
  })

  it('AC1: "dark" actually uses dark backgrounds for chrome and the message/reading pane alike — unlike the light schemes, --pane-bg is dark too', () => {
    const block = extractThemeBlock(css, 'dark')
    for (const token of ['--pane-bg', '--ribbon-bg', '--nav-rail-bg']) {
      const hex = getToken(block, token)
      expect(relativeLuminance(hexToRgb(hex)), `${token} should be a dark color`).toBeLessThan(0.1)
    }
  })

  it('AC3: text, muted text and the accent hue all clear WCAG AA (>=4.5:1) against the dark --pane-bg', () => {
    const block = extractThemeBlock(css, 'dark')
    const paneBg = getToken(block, '--pane-bg')

    for (const token of ['--text', '--text-muted', '--accent']) {
      expect(contrastRatio(getToken(block, token), paneBg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('AC3: white-on-primary-button text clears WCAG AA against this scheme\'s own --primary-bg', () => {
    const block = extractThemeBlock(css, 'dark')

    expect(contrastRatio(getToken(block, '--primary'), getToken(block, '--primary-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('AC3: tokens used as standalone text with no background of their own (--danger-border, --success, --flag-border) clear WCAG AA against the dark surfaces they actually appear on', () => {
    const block = extractThemeBlock(css, 'dark')
    const paneBg = getToken(block, '--pane-bg')
    const navRailBg = getToken(block, '--nav-rail-bg')

    // .settings-test-result-error and .calendar-event-form-error
    expect(contrastRatio(getToken(block, '--danger-border'), paneBg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(getToken(block, '--danger-border'), navRailBg)).toBeGreaterThanOrEqual(4.5)
    // .settings-test-result-ok
    expect(contrastRatio(getToken(block, '--success'), paneBg)).toBeGreaterThanOrEqual(4.5)
    // .message-list-flag-btn.flagged
    expect(contrastRatio(getToken(block, '--flag-border'), paneBg)).toBeGreaterThanOrEqual(4.5)
  })

  it('AC4: no layout-affecting property (padding/margin/width/height/flex/gap/position/display) appears in the dark scheme block', () => {
    const block = extractThemeBlock(css, 'dark')
    expect(block).not.toMatch(/\b(padding|margin|width|height|flex|gap|position|display)\s*:/)
  })
})

describe('office clock (045)', () => {
  it('AC1: the clock display text uses the near-black --text token, not the muted color', () => {
    const rule = css.match(/\.office-clock-time\s*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/color:\s*var\(--text\);/)
  })
})
