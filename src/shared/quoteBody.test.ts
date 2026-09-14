import { describe, expect, it } from 'vitest'
import { quoteBody, type QuotableMessage } from './quoteBody'

const MESSAGE: QuotableMessage = {
  timestamp: new Date('2026-03-01T10:00:00').getTime(),
  fromName: 'Priya Shah',
  fromEmail: 'priya@example.com',
  body: 'Line one\nLine two'
}

describe('quoteBody', () => {
  it('includes an "On <date>, Name <email> wrote:" header', () => {
    expect(quoteBody(MESSAGE)).toContain('Priya Shah <priya@example.com> wrote:')
  })

  it('prefixes every line of the body with "> "', () => {
    const quoted = quoteBody(MESSAGE)
    expect(quoted).toContain('> Line one')
    expect(quoted).toContain('> Line two')
  })

  it('separates the quote block from what precedes it with a blank line', () => {
    expect(quoteBody(MESSAGE).startsWith('\n\n')).toBe(true)
  })

  it('does not crash and still produces a well-formed (if empty) quote line for an empty body', () => {
    const emptyBodyMessage: QuotableMessage = { ...MESSAGE, body: '' }
    expect(() => quoteBody(emptyBodyMessage)).not.toThrow()
    const quoted = quoteBody(emptyBodyMessage)
    expect(quoted).toContain('wrote:\n>')
  })
})
