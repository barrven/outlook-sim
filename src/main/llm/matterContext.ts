import type { GpMatter } from '../../shared/ghostPractice'
import { GP_STATUS_LABELS } from '../../shared/ghostPractice'
import type { MailDb } from '../data/db'

// A per-document cap, not an LLM-generated summary — keeps a very large
// document from blowing out the prompt while staying free/instant. Content
// is already plain text or Markdown, so a hard slice is a reasonable
// "summary" for a training simulator's purposes.
const MAX_DOCUMENT_CONTENT_CHARS = 4000

function truncate(text: string): string {
  return text.length > MAX_DOCUMENT_CONTENT_CHARS
    ? `${text.slice(0, MAX_DOCUMENT_CONTENT_CHARS)}\n[...truncated]`
    : text
}

// Only the facts a client would plausibly know about their own file —
// enough for a persona to stay consistent with what the trainee sees.
function matterFacts(matter: GpMatter): string[] {
  return [
    matter.dateOfLoss && `Date of loss: ${matter.dateOfLoss}`,
    matter.accidentLocation && `Accident location: ${matter.accidentLocation}`,
    matter.insurerCompany && `Insurer: ${matter.insurerCompany}`,
    matter.claimNumber && `Claim #: ${matter.claimNumber}`,
    matter.adjusterName && `Adjuster: ${matter.adjusterName}`,
    matter.injuryTrack && `Injury track: ${matter.injuryTrack}`,
    `Status: ${GP_STATUS_LABELS[matter.status] ?? matter.status}`
  ].filter((line): line is string => Boolean(line))
}

/**
 * Assembles every Ghost Practice matter linked to this persona
 * (matter.clientPersonaId === personaId) into a prompt section — key file
 * facts, the file summary note, and the matter's documents — so the
 * persona can meaningfully reference their own case. Always re-reads from
 * the db — no caching — so an edit is reflected in the very next call.
 * Returns null when the persona has no linked matter, so callers can omit
 * the section entirely rather than including an empty one.
 */
export function buildMatterContextPrompt(db: MailDb, personaId: string): string | null {
  const matters = db.listGpMatters().filter((matter) => matter.clientPersonaId === personaId)
  if (matters.length === 0) return null

  const sections = matters.map((matter) => {
    const lines = [`File ${matter.matterNumber} — "${matter.clientName}":`, ...matterFacts(matter)]
    if (matter.summary) lines.push(`File summary: ${truncate(matter.summary)}`)
    const documents = db.listGpDocuments(matter.id)
    if (documents.length === 0) {
      lines.push('No documents on this file yet.')
    } else {
      lines.push(
        'Documents:',
        documents
          .map((document) =>
            document.content ? `- ${document.name}:\n${truncate(document.content)}` : `- ${document.name}`
          )
          .join('\n\n')
      )
    }
    return lines.join('\n')
  })

  return `Ghost Practice case file contents for this persona (reference specifics from here when relevant):\n\n${sections.join('\n\n')}`
}
