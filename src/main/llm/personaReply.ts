import type { MailMessage, MessageAttachment, Persona, PersonaReplyResult, TraineeIdentity } from '../../shared/data-types'
import { quoteBody } from '../../shared/quoteBody'
import { generateText } from './client'
import { buildFileVineContextPrompt } from './fileVineContext'
import { ATTACHMENT_PROMPT_INSTRUCTION, extractAttachmentBlocks, writeGeneratedAttachment } from './generatedAttachment'
import { readImageAttachment, type ImageAttachmentData } from './imageAttachment'
import type { SimClock } from '../data/clock'
import type { ConfigStore } from '../data/config'
import type { MailDb } from '../data/db'

const NO_REPLY_MARKER = 'NO_REPLY'

function normalizeSubject(subject: string): string {
  let current = subject.trim()
  let stripped = current.replace(/^(re|fwd):\s*/i, '')
  while (stripped !== current) {
    current = stripped.trim()
    stripped = current.replace(/^(re|fwd):\s*/i, '')
  }
  return current.toLowerCase()
}

// Threads aren't tracked by an explicit ID anywhere in this app — matching
// normalized subject + the two participants is the same convention the
// reply/forward Re:/Fwd: prefixing (feature 005) already relies on.
export function findThread(
  allMessages: MailMessage[],
  personaEmail: string,
  traineeEmail: string,
  subject: string
): MailMessage[] {
  const normalized = normalizeSubject(subject)
  const persona = personaEmail.toLowerCase()
  const trainee = traineeEmail.toLowerCase()
  return allMessages
    .filter((message) => normalizeSubject(message.subject) === normalized)
    .filter((message) => {
      const from = message.fromEmail.toLowerCase()
      const to = message.toEmail.toLowerCase()
      return (from === persona && to === trainee) || (from === trainee && to === persona)
    })
    .sort((a, b) => a.timestamp - b.timestamp)
}

function buildSystemPrompt(
  systemPrompt: string,
  persona: Persona,
  identity: TraineeIdentity,
  fileVineContext: string | null
): string {
  return [
    systemPrompt,
    `You are playing ${persona.displayName}${persona.role ? ` (${persona.role})` : ''} in an email training simulation, replying to ${identity.displayName || 'the trainee'}${identity.jobTitle ? ` (${identity.jobTitle})` : ''}.`,
    persona.bio && `Background: ${persona.bio}`,
    persona.writingStyleNotes && `Writing style: ${persona.writingStyleNotes}`,
    persona.extraPrompt,
    fileVineContext,
    `Decide whether a reply is appropriate given the conversation and the guidance above — for example, a purely FYI message may not warrant one. If a reply is NOT warranted, respond with exactly this text and nothing else: ${NO_REPLY_MARKER}`,
    'Otherwise, respond with ONLY the body text of your reply email — no subject line, no meta-commentary about being an AI.',
    ATTACHMENT_PROMPT_INSTRUCTION
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildThreadTranscript(thread: MailMessage[]): string {
  return thread
    .map((message) => {
      // Just tell the model a file was attached, by name, so it doesn't
      // contradict what the trainee can see in their own mailbox by
      // claiming there's none — this line always renders regardless of
      // whether the attachment's content was extracted below.
      const attachmentsLine =
        message.attachments.length > 0
          ? `\nAttachments: ${message.attachments.map((attachment) => attachment.filename).join(', ')}`
          : ''
      // Real attachment content extracted at send time (feature 063) —
      // absent for mock/unsupported/failed-extraction attachments (feature
      // 009's original mock attachments included), which contribute only
      // the filename line above, nothing here.
      const attachmentContent = message.attachments
        .filter((attachment) => attachment.extractedText)
        .map((attachment) => `--- Content of ${attachment.filename} ---\n${attachment.extractedText}`)
        .join('\n\n')
      const body = attachmentContent ? `${message.body}\n\n${attachmentContent}` : message.body
      return `From: ${message.fromName} <${message.fromEmail}>\nTo: ${message.toName} <${message.toEmail}>\nDate: ${new Date(message.timestamp).toISOString()}\nSubject: ${message.subject}${attachmentsLine}\n\n${body}`
    })
    .join('\n\n---\n\n')
}

// Real image attachments (feature 064) are read fresh at generation time,
// not stored as `extractedText` — they ride along as multimodal content
// blocks (see `client.ts`), never OCR'd or text-extracted.
function collectImageAttachments(thread: MailMessage[]): ImageAttachmentData[] {
  return thread
    .flatMap((message) => message.attachments)
    .filter((attachment): attachment is MessageAttachment & { path: string } => Boolean(attachment.path))
    .map((attachment) => readImageAttachment(attachment.path))
    .filter((image): image is ImageAttachmentData => image !== undefined)
}

/**
 * Called after the trainee sends/replies to a message. If the recipient is a
 * configured persona, assembles the system prompt + persona details + thread
 * history and asks the LLM to either write that persona's reply (delivered
 * into Inbox) or decline to reply. Never inserts a message unless the LLM
 * call itself succeeded — a failure degrades to a reported error instead.
 */
export async function generatePersonaReply(
  db: MailDb,
  config: ConfigStore,
  clock: SimClock,
  sentMessageId: string,
  userDataDir: string
): Promise<PersonaReplyResult> {
  const sentMessage = db.getMessage(sentMessageId)
  if (!sentMessage) {
    return { ok: false, error: 'Sent message not found.' }
  }

  const persona = config
    .getPersonas()
    .find((candidate) => candidate.email.toLowerCase() === sentMessage.toEmail.toLowerCase())
  if (!persona) {
    return { ok: true, replied: false }
  }

  const identity = config.getIdentity()
  const { systemPrompt } = config.getSystemPrompt()
  const thread = findThread(db.listMessages(), persona.email, identity.fromEmail, sentMessage.subject)
  const fileVineContext = buildFileVineContextPrompt(db, persona.id)

  const result = await generateText(config.getSettings(), {
    systemPrompt: buildSystemPrompt(systemPrompt, persona, identity, fileVineContext),
    userPrompt: buildThreadTranscript(thread),
    images: collectImageAttachments(thread)
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const { text: withoutAttachments, attachments: parsedAttachments } = extractAttachmentBlocks(result.text)
  const text = withoutAttachments.trim()
  if (text === NO_REPLY_MARKER) {
    return { ok: true, replied: false }
  }

  // Quote the message being replied to (the one that triggered this call),
  // the same "On <date>, X wrote:" convention the trainee's own
  // Reply/Reply All/Forward uses (feature 005) — sentMessage is always
  // present here (checked above), so there's never an empty quote block.
  const body = `${text}${quoteBody(sentMessage)}`

  // Most replies have no document attached (AC5) — only written to disk
  // for each attachment the model actually included.
  const attachments = parsedAttachments.map((attachment) =>
    writeGeneratedAttachment(userDataDir, attachment.filename, attachment.markdown)
  )

  const message = db.createMessage({
    folderId: 'inbox',
    subject: sentMessage.subject,
    body,
    fromName: persona.displayName,
    fromEmail: persona.email,
    toName: identity.displayName,
    toEmail: identity.fromEmail,
    timestamp: clock.now(),
    attachments
  })
  return { ok: true, replied: true, message }
}
