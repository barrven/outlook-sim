import { readFileSync } from 'fs'
import { extname } from 'path'
import { parseOfficeAsync } from 'officeparser'

// Same per-item cap FileVine note content uses (feature 049's
// MAX_NOTE_CONTENT_CHARS) — keeps a very large attachment from blowing out
// the prompt while staying free/instant, no LLM summarization call needed.
const MAX_EXTRACTED_CHARS = 4000

// Read directly as text — no library needed, and CSV's raw comma-separated
// form is already "readable text" for this feature's purposes (no tabular
// reformatting beyond what's on disk).
const PLAIN_TEXT_EXTENSIONS = new Set(['.txt', '.csv'])

// Handled by `officeparser` (chosen specifically at v5.x to avoid pulling in
// its later OCR/tesseract.js dependency — this app has no OCR pipeline by
// design, feature 064 sends images to the LLM directly instead). Legacy
// binary `.doc`/`.xls`/`.ppt` aren't supported by this library and fall
// through to the unsupported-extension case below, same as any other
// unrecognized type.
const OFFICE_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.pptx'])

/**
 * Extracts readable text content from a real attachment file on disk, for
 * the supported types only (PDF, plain text, DOCX, XLSX, CSV, PPTX —
 * feature 063). Never throws: an unsupported extension, a corrupted file,
 * or any other extraction failure resolves to `undefined` rather than
 * blocking the send waiting on this (AC4) — the message still sends with
 * the attachment present, just without extracted content contributing to
 * LLM context.
 */
export async function extractAttachmentText(filePath: string): Promise<string | undefined> {
  const ext = extname(filePath).toLowerCase()
  try {
    let text: string
    if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
      text = readFileSync(filePath, 'utf-8')
    } else if (OFFICE_EXTENSIONS.has(ext)) {
      text = await parseOfficeAsync(filePath)
    } else {
      return undefined
    }
    const trimmed = text.trim()
    if (!trimmed) return undefined
    return trimmed.length > MAX_EXTRACTED_CHARS
      ? `${trimmed.slice(0, MAX_EXTRACTED_CHARS)}\n[...truncated]`
      : trimmed
  } catch {
    return undefined
  }
}
