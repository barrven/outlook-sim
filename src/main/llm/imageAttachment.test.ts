import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readImageAttachment } from './imageAttachment'

describe('readImageAttachment', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-image-attachment-'))
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('AC1: reads a .png file and base64-encodes its raw bytes with the png mime type', () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const filePath = join(baseDir, 'screenshot.png')
    writeFileSync(filePath, bytes)

    const result = readImageAttachment(filePath)

    expect(result).toEqual({ mimeType: 'image/png', base64Data: bytes.toString('base64') })
  })

  it('AC1: reads a .jpg file with the jpeg mime type', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    const filePath = join(baseDir, 'photo.jpg')
    writeFileSync(filePath, bytes)

    const result = readImageAttachment(filePath)

    expect(result).toEqual({ mimeType: 'image/jpeg', base64Data: bytes.toString('base64') })
  })

  it('AC1: reads a .jpeg file with the jpeg mime type', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe1])
    const filePath = join(baseDir, 'photo.jpeg')
    writeFileSync(filePath, bytes)

    const result = readImageAttachment(filePath)

    expect(result).toEqual({ mimeType: 'image/jpeg', base64Data: bytes.toString('base64') })
  })

  it('AC1: matching is case-insensitive on the extension', () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const filePath = join(baseDir, 'screenshot.PNG')
    writeFileSync(filePath, bytes)

    expect(readImageAttachment(filePath)).toEqual({ mimeType: 'image/png', base64Data: bytes.toString('base64') })
  })

  it('AC3: does not run any OCR/text extraction — the base64 payload is exactly the raw file bytes', () => {
    // A guard against accidentally routing image bytes through a
    // text/markdown pipeline: decoding the result must reproduce the
    // original binary exactly, not some derived/extracted text.
    const bytes = Buffer.from('not real image data but treated as opaque bytes', 'utf-8')
    const filePath = join(baseDir, 'diagram.png')
    writeFileSync(filePath, bytes)

    const result = readImageAttachment(filePath)

    expect(Buffer.from(result!.base64Data, 'base64')).toEqual(bytes)
  })

  it('resolves to undefined for an unsupported extension (e.g. .gif)', () => {
    const filePath = join(baseDir, 'animation.gif')
    writeFileSync(filePath, Buffer.from([0x47, 0x49, 0x46]))

    expect(readImageAttachment(filePath)).toBeUndefined()
  })

  it('resolves to undefined for a non-image extension', () => {
    const filePath = join(baseDir, 'report.pdf')
    writeFileSync(filePath, 'not really a pdf')

    expect(readImageAttachment(filePath)).toBeUndefined()
  })

  it('resolves to undefined for a nonexistent file rather than throwing', () => {
    expect(readImageAttachment(join(baseDir, 'does-not-exist.png'))).toBeUndefined()
  })
})
