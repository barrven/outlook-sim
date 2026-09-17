import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractAttachmentText } from './attachmentExtraction'

const FIXTURES_DIR = join(__dirname, 'attachmentFixtures')

describe('extractAttachmentText', () => {
  it('AC3: extracts readable text from a plain .txt file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.txt'))
    expect(text).toContain('MARKER_TXT_PLAIN')
  })

  it('AC3: extracts readable text from a .csv file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.csv'))
    expect(text).toContain('MARKER_CSV_PLAIN')
  })

  it('AC3: extracts readable text from a .docx file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.docx'))
    expect(text).toContain('MARKER_TXT_CONTENT')
  })

  it('AC3: extracts readable text from an .xlsx file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.xlsx'))
    expect(text).toContain('MARKER_XLSX_CONTENT')
  })

  it('AC3: extracts readable text from a .pdf file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.pdf'))
    expect(text).toContain('MARKER_TXT_CONTENT')
  })

  it('AC3: extracts readable text from a .pptx file', async () => {
    const text = await extractAttachmentText(join(FIXTURES_DIR, 'sample.pptx'))
    expect(text).toContain('MARKER_PPTX_CONTENT')
  })

  describe('AC4: does not block on unsupported types or failures', () => {
    let baseDir: string

    beforeEach(() => {
      baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-attachment-extraction-'))
    })

    afterEach(() => {
      rmSync(baseDir, { recursive: true, force: true })
    })

    it('resolves to undefined for an unsupported extension', async () => {
      const filePath = join(baseDir, 'photo.png')
      writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      expect(await extractAttachmentText(filePath)).toBeUndefined()
    })

    it('resolves to undefined for a legacy binary .ppt (unsupported by officeparser)', async () => {
      const filePath = join(baseDir, 'legacy.ppt')
      writeFileSync(filePath, 'not a real ppt file')

      expect(await extractAttachmentText(filePath)).toBeUndefined()
    })

    it('resolves to undefined for a nonexistent file rather than throwing', async () => {
      expect(await extractAttachmentText(join(baseDir, 'does-not-exist.txt'))).toBeUndefined()
    })

    it('resolves to undefined for a corrupted file with a supported extension', async () => {
      const filePath = join(baseDir, 'corrupted.docx')
      writeFileSync(filePath, 'this is not a real zip/docx file')

      expect(await extractAttachmentText(filePath)).toBeUndefined()
    })

    it('resolves to undefined for an empty file', async () => {
      const filePath = join(baseDir, 'empty.txt')
      writeFileSync(filePath, '')

      expect(await extractAttachmentText(filePath)).toBeUndefined()
    })
  })

  describe('truncation (mirrors feature 049\'s FileVine 4000-char cap)', () => {
    let baseDir: string

    beforeEach(() => {
      baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-attachment-extraction-trunc-'))
    })

    afterEach(() => {
      rmSync(baseDir, { recursive: true, force: true })
    })

    it('truncates a very large text file rather than including it in full', async () => {
      const filePath = join(baseDir, 'huge.txt')
      const hugeContent = 'x'.repeat(10_000)
      writeFileSync(filePath, hugeContent)

      const text = await extractAttachmentText(filePath)

      expect(text).toBeDefined()
      expect(text!.length).toBeLessThan(hugeContent.length)
      expect(text).toContain('[...truncated]')
    })

    it('does not truncate a text file within the size cap', async () => {
      const filePath = join(baseDir, 'small.txt')
      const content = 'y'.repeat(500)
      writeFileSync(filePath, content)

      const text = await extractAttachmentText(filePath)

      expect(text).toBe(content)
      expect(text).not.toContain('[...truncated]')
    })
  })
})
