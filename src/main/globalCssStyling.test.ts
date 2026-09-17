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

// The default color scheme's tokens live in this attribute-selector block
// (058), not the bare `:root { ... }` one — which now holds only the
// scheme-independent radius tokens (037).
function extractDefaultThemeBlock(source: string): string {
  const match = source.match(/:root\[data-theme=['"]default['"]\]\s*{([^}]*)}/)
  if (!match) throw new Error(":root[data-theme='default'] block not found in global.css")
  return match[1]
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
    const withoutTokenBlocks = css
      .replace(/:root\s*{[^}]*}/, '')
      .replace(/:root\[data-theme=['"]default['"]\]\s*{[^}]*}/, '')

    expect(withoutTokenBlocks).not.toMatch(/#[0-9a-fA-F]{3,8}/)
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

describe('office clock (045)', () => {
  it('AC1: the clock display text uses the near-black --text token, not the muted color', () => {
    const rule = css.match(/\.office-clock-time\s*{[^}]*}/)
    expect(rule).not.toBeNull()
    expect(rule![0]).toMatch(/color:\s*var\(--text\);/)
  })
})
