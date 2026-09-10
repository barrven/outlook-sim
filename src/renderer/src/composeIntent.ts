import type { ComposeIntent, MailMessage, MessageRecipient, TraineeIdentity } from '../../shared/data-types'

export type { ComposeIntent }

export interface ComposeSeed {
  toName: string
  toEmail: string
  cc: MessageRecipient[]
  subject: string
  body: string
}

function addSubjectPrefix(subject: string, prefix: 'Re:' | 'Fwd:'): string {
  const trimmed = subject.trim()
  if (new RegExp(`^${prefix}\\s`, 'i').test(trimmed)) return trimmed
  return trimmed ? `${prefix} ${trimmed}` : prefix
}

function quoteBody(message: MailMessage): string {
  const header = `On ${new Date(message.timestamp).toLocaleString()}, ${message.fromName} <${message.fromEmail}> wrote:`
  const quoted = message.body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return `\n\n${header}\n${quoted}`
}

export function buildComposeSeed(
  intent: ComposeIntent,
  message: MailMessage,
  identity: TraineeIdentity
): ComposeSeed {
  const body = quoteBody(message)

  if (intent === 'forward') {
    return { toName: '', toEmail: '', cc: [], subject: addSubjectPrefix(message.subject, 'Fwd:'), body }
  }

  const cc: MessageRecipient[] = []
  if (intent === 'replyAll') {
    const selfEmail = identity.fromEmail.toLowerCase()
    const seen = new Set([message.fromEmail.toLowerCase(), selfEmail])
    if (message.toEmail && !seen.has(message.toEmail.toLowerCase())) {
      cc.push({ name: message.toName, email: message.toEmail })
      seen.add(message.toEmail.toLowerCase())
    }
    for (const recipient of message.cc) {
      if (!seen.has(recipient.email.toLowerCase())) {
        cc.push(recipient)
        seen.add(recipient.email.toLowerCase())
      }
    }
  }

  return {
    toName: message.fromName,
    toEmail: message.fromEmail,
    cc,
    subject: addSubjectPrefix(message.subject, 'Re:'),
    body
  }
}
