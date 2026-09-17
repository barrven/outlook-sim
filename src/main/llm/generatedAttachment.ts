import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import type { MessageAttachment } from '../../shared/data-types'

const ATTACHMENTS_SUBDIR = 'generated-attachments'

// LLM protocol (feature 065): a persona reply or unsolicited-mail response
// may optionally end with this fenced block naming a document to attach,
// distinct from the email body itself. Anchored to the end of the raw
// response — everything before it is the actual email text, regardless of
// which format that text is in (a bare reply body, or scheduler.ts's
// "Subject: ...\n\n<body>").
const ATTACHMENT_BLOCK_REGEX = /\n*---ATTACHMENT:\s*(.+?)\s*---\n([\s\S]*?)\n---END ATTACHMENT---\s*$/

// The prompt instruction both personaReply.ts and scheduler.ts append,
// verbatim, so the protocol only needs to be described in one place.
export const ATTACHMENT_PROMPT_INSTRUCTION =
  'If, and only if, a real document genuinely belongs with this email (e.g. an invoice, contract draft, settlement offer, or report the persona would realistically send) — most emails do NOT need one — append it after the email text in exactly this format, with nothing after it:\n---ATTACHMENT: <filename.html>---\n<the document\'s full content, written in Markdown>\n---END ATTACHMENT---'

export interface ParsedGeneration {
  /** The raw response with the attachment block (if any) stripped from the end. */
  text: string
  attachment: { filename: string; markdown: string } | null
}

/**
 * Splits an optional trailing attachment block off a raw LLM response.
 * Never throws: a missing or malformed block (e.g. the model didn't close
 * it properly) just means `attachment: null` and the raw text passed
 * through untouched, since attaching a document is opportunistic, never
 * required (AC5).
 */
export function extractAttachmentBlock(rawText: string): ParsedGeneration {
  const match = rawText.match(ATTACHMENT_BLOCK_REGEX)
  if (!match) return { text: rawText, attachment: null }
  const filename = match[1].trim()
  const markdown = match[2].trim()
  if (!filename || !markdown) return { text: rawText, attachment: null }
  return { text: rawText.slice(0, match.index), attachment: { filename, markdown } }
}

// The filename comes from the LLM, so it's untrusted input that ends up in
// a real filesystem path — strip separators/traversal and force a `.html`
// extension regardless of what the model asked for (AC2: always a real
// HTML file, never whatever extension it hallucinated).
function toHtmlFilename(rawFilename: string): string {
  const base = rawFilename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
  const withoutExtension = base.replace(/\.[^./]+$/, '') || 'document'
  return `${withoutExtension}.html`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Renders LLM-authored Markdown into a real, standalone HTML file under a
 * fresh per-attachment directory inside the app's local data directory
 * (never colliding, never overwriting another generated attachment) — a
 * genuine file on disk, not a filename placeholder, that survives app
 * restarts like any other file there (AC2/AC4). `extractedText` carries the
 * same Markdown so a later reply's LLM context can reference it, the same
 * way a real uploaded attachment's extracted content does (feature 063).
 */
export function writeGeneratedAttachment(userDataDir: string, filename: string, markdown: string): MessageAttachment {
  const dir = join(userDataDir, ATTACHMENTS_SUBDIR, randomUUID())
  mkdirSync(dir, { recursive: true })
  const htmlFilename = toHtmlFilename(filename)
  const path = join(dir, htmlFilename)
  const rawBodyHtml = marked.parse(markdown, { async: false }) as string
  // The Markdown source is LLM-authored (indirectly influenced by
  // trainer-supplied prompts/personas), and this file gets opened via the
  // OS's own handler (typically the user's default browser) — sanitize on
  // the same principle `renderMarkdown` already applies to trainee-authored
  // FileVine notes rendered inside the app itself.
  const bodyHtml = sanitizeHtml(rawBodyHtml)
  const html = `<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>${escapeHtml(htmlFilename)}</title></head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`
  writeFileSync(path, html, 'utf-8')
  return { filename: htmlFilename, path, extractedText: markdown }
}
