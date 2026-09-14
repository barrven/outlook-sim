// Shared between the renderer's own Reply/Reply All/Forward quoting
// (feature 005) and the main process's persona-reply generation (feature
// 024/B003), so both quote a prior message the exact same way.

export interface QuotableMessage {
  timestamp: number
  fromName: string
  fromEmail: string
  body: string
}

export function quoteBody(message: QuotableMessage): string {
  const header = `On ${new Date(message.timestamp).toLocaleString()}, ${message.fromName} <${message.fromEmail}> wrote:`
  const quoted = message.body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
  return `\n\n${header}\n${quoted}`
}
