import type { MailMessage, Persona, TraineeIdentity } from '../../shared/data-types'
import { generateText } from './client'
import type { SimClock } from '../data/clock'
import type { ConfigStore } from '../data/config'
import type { MailDb } from '../data/db'

const NO_REPLY_MARKER = 'NO_REPLY'

export type PersonaReplyResult =
  | { ok: true; replied: true; message: MailMessage }
  | { ok: true; replied: false }
  | { ok: false; error: string }

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

function buildSystemPrompt(systemPrompt: string, persona: Persona, identity: TraineeIdentity): string {
  return [
    systemPrompt,
    `You are playing ${persona.displayName}${persona.role ? ` (${persona.role})` : ''} in an email training simulation, replying to ${identity.displayName || 'the trainee'}${identity.jobTitle ? ` (${identity.jobTitle})` : ''}.`,
    persona.bio && `Background: ${persona.bio}`,
    persona.writingStyleNotes && `Writing style: ${persona.writingStyleNotes}`,
    persona.extraPrompt,
    `Decide whether a reply is appropriate given the conversation and the guidance above — for example, a purely FYI message may not warrant one. If a reply is NOT warranted, respond with exactly this text and nothing else: ${NO_REPLY_MARKER}`,
    'Otherwise, respond with ONLY the body text of your reply email — no subject line, no meta-commentary about being an AI.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildThreadTranscript(thread: MailMessage[]): string {
  return thread
    .map(
      (message) =>
        `From: ${message.fromName} <${message.fromEmail}>\nTo: ${message.toName} <${message.toEmail}>\nDate: ${new Date(message.timestamp).toISOString()}\nSubject: ${message.subject}\n\n${message.body}`
    )
    .join('\n\n---\n\n')
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
  sentMessageId: string
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

  const result = await generateText(config.getSettings(), {
    systemPrompt: buildSystemPrompt(systemPrompt, persona, identity),
    userPrompt: buildThreadTranscript(thread)
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const text = result.text.trim()
  if (text === NO_REPLY_MARKER) {
    return { ok: true, replied: false }
  }

  const message = db.createMessage({
    folderId: 'inbox',
    subject: sentMessage.subject,
    body: text,
    fromName: persona.displayName,
    fromEmail: persona.email,
    toName: identity.displayName,
    toEmail: identity.fromEmail,
    timestamp: clock.now()
  })
  return { ok: true, replied: true, message }
}
