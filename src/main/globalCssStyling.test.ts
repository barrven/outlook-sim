import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, '../renderer/src/styles/global.css'), 'utf-8')

function extractRootBlock(source: string): string {
  const match = source.match(/:root\s*{([^}]*)}/)
  if (!match) throw new Error(':root block not found in global.css')
  return match[1]
}

describe('global.css semantic tokens (037)', () => {
  it('AC1: defines the semantic status color tokens used across the app', () => {
    const root = extractRootBlock(css)

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
      expect(root).toMatch(new RegExp(`${token}:\\s*#[0-9a-fA-F]{3,8};`))
    }
  })

  it('AC1: no hardcoded hex color appears outside :root — every color is a token', () => {
    const withoutRoot = css.replace(/:root\s*{[^}]*}/, '')

    expect(withoutRoot).not.toMatch(/#[0-9a-fA-F]{3,8}/)
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

  it('AC3: the flagged message-list indicator and Reading Pane flag toggle both use the danger token', () => {
    expect(css).toMatch(/\.message-list-flag-btn\.flagged\s*{\s*color:\s*var\(--danger\);\s*}/)
    expect(css).toMatch(/\.reading-pane-flag-toggle\.flagged\s*{[^}]*color:\s*var\(--danger\);/)
  })
})
