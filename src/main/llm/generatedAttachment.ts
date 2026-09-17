import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import type { MessageAttachment } from '../../shared/data-types'

const ATTACHMENTS_SUBDIR = 'generated-attachments'

// LLM protocol (feature 065): a persona reply or unsolicited-mail response
// may include one or more of these fenced blocks, each naming a document to
// attach, distinct from the email body itself. Not anchored to a fixed
// position (a `g` match below finds every occurrence anywhere in the raw
// response) since a model narrating several documents tends to place each
// block right after mentioning that document, not all bunched at the very
// end.
// Only the leading newline (the one separating the block from whatever
// precedes it) is consumed — never the trailing one(s) — so removing a
// block doesn't also swallow the paragraph break/blank line that follows
// it (e.g. before the next numbered item in a list of several documents).
const ATTACHMENT_BLOCK_REGEX = /\n*---ATTACHMENT:\s*(.+?)\s*---\n([\s\S]*?)\n---END ATTACHMENT---/g

// The prompt instruction both personaReply.ts and scheduler.ts append,
// verbatim, so the protocol only needs to be described in one place. Found
// via live testing (feature 065's post-accept bug report): a real model
// asked to write a "realistic" email defaults to *narrating* attachments in
// prose ("Attaching the following: 1... 2... 3...") without ever emitting
// the mechanical block below, since nothing tied the two together — this
// wording now makes that combination explicitly wrong in both directions.
export const ATTACHMENT_PROMPT_INSTRUCTION =
  'Most emails do NOT need a document attached — when in doubt, don\'t attach one and don\'t mention attaching one. If a real document genuinely belongs with this email (e.g. an invoice, contract draft, settlement offer, or report the persona would realistically send), you MUST include it using the block format below, one block per document, placed anywhere after the email text. This is a hard rule: NEVER write text like "attached is...", "please see the attached...", or a list of attachment names UNLESS you also include a matching block for each one — text alone does not create a real attachment. Conversely, never include a block for a document you don\'t actually mention in the email.\nBlock format (repeat once per document):\n---ATTACHMENT: <filename.html>---\n<the document\'s full content, written in Markdown>\n---END ATTACHMENT---'

export interface ParsedGeneration {
  /** The raw response with every attachment block stripped out. */
  text: string
  attachments: { filename: string; markdown: string }[]
}

/**
 * Splits zero or more attachment blocks out of a raw LLM response, wherever
 * they appear. Never throws: a malformed block (e.g. the model didn't close
 * it properly) is simply left in place as ordinary text and contributes no
 * attachment, since attaching a document is opportunistic, never required
 * (AC5) — a parsing edge case should never be able to break a send.
 */
export function extractAttachmentBlocks(rawText: string): ParsedGeneration {
  const attachments: { filename: string; markdown: string }[] = []
  const text = rawText.replace(ATTACHMENT_BLOCK_REGEX, (_match, rawFilename: string, rawMarkdown: string) => {
    const filename = rawFilename.trim()
    const markdown = rawMarkdown.trim()
    if (filename && markdown) attachments.push({ filename, markdown })
    return ''
  })
  return { text, attachments }
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
