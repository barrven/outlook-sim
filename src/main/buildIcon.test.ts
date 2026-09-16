import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('packaged app icon (036)', () => {
  it('electron-builder is configured to build the Windows icon from a PNG source, not a hand-built .ico', () => {
    const config = readFileSync(join(__dirname, '../../electron-builder.yml'), 'utf-8')
    const match = config.match(/^\s*icon:\s*(\S+)\s*$/m)

    expect(match).not.toBeNull()
    const iconPath = match![1]
    expect(iconPath).toMatch(/\.png$/)

    const resolved = join(__dirname, '../..', iconPath)
    const bytes = readFileSync(resolved)
    expect(bytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE)
  })
})
