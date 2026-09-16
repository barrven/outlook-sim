import type { MailDb } from '../data/db'

// A per-note cap, not an LLM-generated summary — keeps a very large note
// from blowing out the prompt while staying free/instant. "content" here
// is already plain Markdown text (feature 048), so a hard slice is a
// reasonable "summary" for a training simulator's purposes.
const MAX_NOTE_CONTENT_CHARS = 4000

/**
 * Assembles the FileVine notes/files for every folder associated with this
 * persona (folder.clientPersonaId === personaId) into a prompt section, so
 * the persona can meaningfully reference case documents. Always re-reads
 * from the db — no caching — so a folder edit is reflected in the very
 * next call. Returns null when the persona has no associated folder, so
 * callers can omit the section entirely rather than including an empty one
 * (feature 049 AC2: no-folder personas generate exactly as before).
 */
export function buildFileVineContextPrompt(db: MailDb, personaId: string): string | null {
  const folders = db.listFileVineFolders().filter((folder) => folder.clientPersonaId === personaId)
  if (folders.length === 0) return null

  const sections = folders.map((folder) => {
    const notes = db.listFileVineNotes(folder.id)
    if (notes.length === 0) return `Folder "${folder.name}": no notes/files yet.`
    const noteText = notes
      .map((note) => {
        const content =
          note.content.length > MAX_NOTE_CONTENT_CHARS
            ? `${note.content.slice(0, MAX_NOTE_CONTENT_CHARS)}\n[...truncated]`
            : note.content
        return `- ${note.name}:\n${content}`
      })
      .join('\n\n')
    return `Folder "${folder.name}":\n${noteText}`
  })

  return `FileVine case file contents for this persona (reference specifics from here when relevant):\n\n${sections.join('\n\n')}`
}
