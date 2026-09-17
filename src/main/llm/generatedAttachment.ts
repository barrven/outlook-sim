import { randomUUID } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import type { MessageAttachment } from '../../shared/data-types'

const ATTACHMENTS_SUBDIR = 'generated-attachments'

// LLM protocol (feature 065): a persona reply or unsolicited-mail response
// may include one or more of these marker lines, each starting a document to
// attach, distinct from the email body itself. Deliberately has NO closing
// marker (an earlier version required one and it failed in live testing —
// a model writing a long, multi-section document reliably forgets to also
// append an arbitrary closing sentinel once it's done writing; a real
// captured failure was a full OCF-3 form, thousands of characters, with no
// end marker anywhere). Instead, a document's content is simply everything
// from its marker line up to the next marker line, or the end of the
// response — no separate "did the model close it" failure mode possible.
const ATTACHMENT_MARKER_REGEX = /\n*---ATTACHMENT:\s*(.+?)\s*---\n/g

// A model that DOES still write a closing marker (most likely for a short
// document) gets it stripped for a clean result, but it's never required.
const TRAILING_END_MARKER_REGEX = /\n*---END ATTACHMENT---\s*$/

// The prompt instruction both personaReply.ts and scheduler.ts append,
// verbatim, so the protocol only needs to be described in one place. Found
// via live testing (feature 065's post-accept bug reports): (1) a real
// model asked to write a "realistic" email defaults to *narrating*
// attachments in prose ("Attaching the following: 1... 2... 3...") without
// ever emitting the mechanical marker, since nothing tied the two together;
// (2) once it does use the marker, a long generated document reliably never
// reaches a required closing marker. This wording addresses both: the
// marker is now an explicit hard requirement tied to any attachment
// narration, and there is nothing to forget to close.
export const ATTACHMENT_PROMPT_INSTRUCTION =
  'Most emails do NOT need a document attached — when in doubt, don\'t attach one and don\'t mention attaching one. If a real document genuinely belongs with this email (e.g. an invoice, contract draft, settlement offer, or report the persona would realistically send), you MUST include it using the marker format below. This is a hard rule: NEVER write text like "attached is...", "please see the attached...", or a list of attachment names UNLESS you also include a matching marker for each one — text alone does not create a real attachment. Conversely, never include a marker for a document you don\'t actually mention.\nMarker format — put this exact line right before each document, with nothing else on that line, then simply write the full document as Markdown (there is no closing marker; the document runs until your response ends or the next such line begins, so ALL of your actual email text must come before the first one of these lines):\n---ATTACHMENT: <filename.html>---'

export interface ParsedGeneration {
  /** The raw response with every attachment marker and its document content stripped out. */
  text: string
  attachments: { filename: string; markdown: string }[]
}

/**
 * Splits zero or more attachment documents out of a raw LLM response. Each
 * document runs from its `---ATTACHMENT: <filename>---` marker line to the
 * next marker (or end of text) — never throws, and a response with no
 * marker at all just returns it unchanged with an empty `attachments` array
 * (AC5 — attaching a document is opportunistic, never required).
 */
export function extractAttachmentBlocks(rawText: string): ParsedGeneration {
  const markers: { filename: string; markerStart: number; contentStart: number }[] = []
  ATTACHMENT_MARKER_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTACHMENT_MARKER_REGEX.exec(rawText)) !== null) {
    const filename = match[1].trim()
    // An unnamed marker is never treated as a split point — otherwise
    // whatever real content follows it would be sliced off as that
    // "attachment"'s content and then silently discarded once filtered out
    // for having no filename, losing text that was never meant to vanish.
    if (!filename) continue
    markers.push({ filename, markerStart: match.index, contentStart: match.index + match[0].length })
  }
  if (markers.length === 0) return { text: rawText, attachments: [] }

  const text = rawText.slice(0, markers[0].markerStart)
  const attachments = markers
    .map((marker, i) => {
      const contentEnd = i + 1 < markers.length ? markers[i + 1].markerStart : rawText.length
      const markdown = rawText.slice(marker.contentStart, contentEnd).replace(TRAILING_END_MARKER_REGEX, '').trim()
      return { filename: marker.filename, markdown }
    })
    .filter((attachment) => attachment.markdown)

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
