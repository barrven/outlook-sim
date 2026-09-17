import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractAttachmentBlock, writeGeneratedAttachment } from './generatedAttachment'

describe('extractAttachmentBlock', () => {
  it('AC1: splits a well-formed trailing attachment block off the raw text', () => {
    const raw =
      'Sure, attached is the breakdown.\n---ATTACHMENT: breakdown.html---\n# Breakdown\n\nMedical: $12,000\n---END ATTACHMENT---'

    const { text, attachment } = extractAttachmentBlock(raw)

    expect(text.trim()).toBe('Sure, attached is the breakdown.')
    expect(attachment).toEqual({ filename: 'breakdown.html', markdown: '# Breakdown\n\nMedical: $12,000' })
  })

  it('AC5: returns no attachment for a plain response with no block', () => {
    const { text, attachment } = extractAttachmentBlock('Sure, noon works!')

    expect(text).toBe('Sure, noon works!')
    expect(attachment).toBeNull()
  })

  it('does not require a block to be present in Subject/body-formatted text', () => {
    const raw = 'Subject: Invoice due\n\nPlease see the attached invoice.'

    const { text, attachment } = extractAttachmentBlock(raw)

    expect(text).toBe(raw)
    expect(attachment).toBeNull()
  })

  it('extracts the block from the tail of Subject/body-formatted text, leaving the rest intact', () => {
    const raw =
      'Subject: Invoice due\n\nPlease see the attached invoice.\n---ATTACHMENT: invoice.html---\n# Invoice\n\nAmount due: $500\n---END ATTACHMENT---'

    const { text, attachment } = extractAttachmentBlock(raw)

    expect(text.trim()).toBe('Subject: Invoice due\n\nPlease see the attached invoice.')
    expect(attachment).toEqual({ filename: 'invoice.html', markdown: '# Invoice\n\nAmount due: $500' })
  })

  it('gracefully falls back to no attachment for a malformed block missing the closing marker', () => {
    const raw = 'Here you go.\n---ATTACHMENT: report.html---\n# Report\n\nSome content, never closed.'

    const { text, attachment } = extractAttachmentBlock(raw)

    expect(text).toBe(raw)
    expect(attachment).toBeNull()
  })

  it('gracefully falls back to no attachment for an empty filename or empty content', () => {
    const emptyFilename = 'Here.\n---ATTACHMENT: ---\nSome content\n---END ATTACHMENT---'
    const emptyContent = 'Here.\n---ATTACHMENT: report.html---\n\n---END ATTACHMENT---'

    expect(extractAttachmentBlock(emptyFilename).attachment).toBeNull()
    expect(extractAttachmentBlock(emptyContent).attachment).toBeNull()
  })
})

describe('writeGeneratedAttachment', () => {
  let userDataDir: string

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'outlook-sim-generated-attachment-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('AC2: renders Markdown into a real HTML file on disk under the app data directory', () => {
    const attachment = writeGeneratedAttachment(userDataDir, 'breakdown.html', '# Breakdown\n\nMedical: $12,000')

    expect(existsSync(attachment.path!)).toBe(true)
    expect(attachment.path!.startsWith(userDataDir)).toBe(true)
    const html = readFileSync(attachment.path!, 'utf-8')
    expect(html).toContain('<h1>Breakdown</h1>')
    expect(html).toContain('Medical: $12,000')
  })

  it('AC4: carries the source Markdown as extractedText, for a later reply\'s LLM context', () => {
    const attachment = writeGeneratedAttachment(userDataDir, 'notes.html', 'Some **bold** notes.')

    expect(attachment.extractedText).toBe('Some **bold** notes.')
  })

  it('always forces a .html extension, regardless of what the model asked for', () => {
    const attachment = writeGeneratedAttachment(userDataDir, 'invoice.pdf', '# Invoice')

    expect(attachment.filename).toBe('invoice.html')
    expect(attachment.path).toMatch(/invoice\.html$/)
  })

  it('sanitizes a path-traversal filename so it can never escape its own directory', () => {
    const attachment = writeGeneratedAttachment(userDataDir, '../../etc/passwd', '# Content')

    expect(attachment.path!.startsWith(userDataDir)).toBe(true)
    expect(attachment.path).not.toContain('..')
  })

  it('strips a script tag embedded in the Markdown source before writing to disk', () => {
    const attachment = writeGeneratedAttachment(
      userDataDir,
      'doc.html',
      '# Hello\n\n<script>alert(1)</script>\n\nSome text.'
    )

    const html = readFileSync(attachment.path!, 'utf-8')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('Some text.')
  })

  it('two attachments with the same requested filename never collide or overwrite each other', () => {
    const first = writeGeneratedAttachment(userDataDir, 'report.html', '# First report')
    const second = writeGeneratedAttachment(userDataDir, 'report.html', '# Second report')

    expect(first.path).not.toBe(second.path)
    expect(readFileSync(first.path!, 'utf-8')).toContain('First report')
    expect(readFileSync(second.path!, 'utf-8')).toContain('Second report')
  })
})
