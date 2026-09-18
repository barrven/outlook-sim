import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractAttachmentBlocks, writeGeneratedAttachment } from './generatedAttachment'

describe('extractAttachmentBlocks', () => {
  it('AC1: captures a document with no closing marker at all, running to the end of the response', () => {
    // The actual real-world failure this design was rewritten for: a model
    // wrote a long, multi-section document and never appended a closing
    // marker. There is no closing marker to forget in this protocol.
    const raw =
      'Sure, attached is the breakdown.\n---ATTACHMENT: breakdown.html---\n# Breakdown\n\n## Part 1\n\nMedical: $12,000\n\n## Part 2\n\nLost wages: $4,500'

    const { text, attachments } = extractAttachmentBlocks(raw)

    expect(text.trim()).toBe('Sure, attached is the breakdown.')
    expect(attachments).toEqual([
      { filename: 'breakdown.html', markdown: '# Breakdown\n\n## Part 1\n\nMedical: $12,000\n\n## Part 2\n\nLost wages: $4,500' }
    ])
  })

  it('AC5: returns no attachments for a plain response with no marker', () => {
    const { text, attachments } = extractAttachmentBlocks('Sure, noon works!')

    expect(text).toBe('Sure, noon works!')
    expect(attachments).toEqual([])
  })

  it('does not require a marker to be present in Subject/body-formatted text', () => {
    const raw = 'Subject: Invoice due\n\nPlease see the attached invoice.'

    const { text, attachments } = extractAttachmentBlocks(raw)

    expect(text).toBe(raw)
    expect(attachments).toEqual([])
  })

  it('extracts a document that starts at the tail of Subject/body-formatted text, leaving the email text intact', () => {
    const raw = 'Subject: Invoice due\n\nPlease see the attached invoice.\n---ATTACHMENT: invoice.html---\n# Invoice\n\nAmount due: $500'

    const { text, attachments } = extractAttachmentBlocks(raw)

    expect(text.trim()).toBe('Subject: Invoice due\n\nPlease see the attached invoice.')
    expect(attachments).toEqual([{ filename: 'invoice.html', markdown: '# Invoice\n\nAmount due: $500' }])
  })

  it('extracts multiple documents from one response, each running up to the next marker', () => {
    const raw =
      'Attaching two things:\n---ATTACHMENT: intake.html---\n# Intake form\n\nSome detail.\n---ATTACHMENT: checklist.html---\n# Checklist\n\n- Item one\n- Item two'

    const { text, attachments } = extractAttachmentBlocks(raw)

    expect(attachments).toEqual([
      { filename: 'intake.html', markdown: '# Intake form\n\nSome detail.' },
      { filename: 'checklist.html', markdown: '# Checklist\n\n- Item one\n- Item two' }
    ])
    expect(text.trim()).toBe('Attaching two things:')
    expect(text).not.toContain('---ATTACHMENT')
  })

  it('still strips an optional closing marker when a model does include one, for a clean document', () => {
    const raw = 'Here you go.\n---ATTACHMENT: report.html---\n# Report\n\nSome content.\n---END ATTACHMENT---'

    const { attachments } = extractAttachmentBlocks(raw)

    expect(attachments).toEqual([{ filename: 'report.html', markdown: '# Report\n\nSome content.' }])
  })

  it('treats an unnamed marker as ordinary text rather than a split point, so nothing after it is lost', () => {
    const raw = 'Here.\n---ATTACHMENT: ---\nSome content that must not vanish.'

    const { text, attachments } = extractAttachmentBlocks(raw)

    expect(attachments).toEqual([])
    expect(text).toBe(raw)
    expect(text).toContain('Some content that must not vanish.')
  })

  it('gracefully skips a marker with no real content after it (whitespace only)', () => {
    const raw = 'Here.\n---ATTACHMENT: report.html---\n   \n'

    expect(extractAttachmentBlocks(raw).attachments).toEqual([])
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

  it('066: marks the attachment as generated, so the UI can offer "Save to FileVine" only for it', () => {
    const attachment = writeGeneratedAttachment(userDataDir, 'notes.html', 'Some **bold** notes.')

    expect(attachment.generated).toBe(true)
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
