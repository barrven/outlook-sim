import { describe, expect, it } from 'vitest'
import { buildComposeSeed } from './composeIntent'
import type { MailMessage, TraineeIdentity } from '../../shared/data-types'

const IDENTITY: TraineeIdentity = {
  displayName: 'Jordan Trainee',
  jobTitle: 'Analyst',
  fromEmail: 'jordan.trainee@example.com'
}

const BASE_MESSAGE: MailMessage = {
  id: 'msg-1',
  folderId: 'inbox',
  previousFolderId: null,
  subject: 'Quarterly numbers',
  body: 'Line one\nLine two',
  fromName: 'Priya Shah',
  fromEmail: 'priya@example.com',
  toName: 'Jordan Trainee',
  toEmail: 'jordan.trainee@example.com',
  cc: [],
  timestamp: new Date('2026-01-15T10:00:00').getTime(),
  isRead: true,
  isFlagged: false,
  categories: [],
  attachments: []
}

describe('buildComposeSeed', () => {
  describe('reply', () => {
    it('pre-fills To with the original sender and quotes the original body', () => {
      const seed = buildComposeSeed('reply', BASE_MESSAGE, IDENTITY)

      expect(seed.toEmail).toBe('priya@example.com')
      expect(seed.toName).toBe('Priya Shah')
      expect(seed.cc).toEqual([])
      expect(seed.body).toContain('> Line one')
      expect(seed.body).toContain('> Line two')
      expect(seed.body).toContain('Priya Shah <priya@example.com> wrote:')
    })

    it('prefixes the subject with Re:', () => {
      const seed = buildComposeSeed('reply', BASE_MESSAGE, IDENTITY)
      expect(seed.subject).toBe('Re: Quarterly numbers')
    })

    it('does not duplicate an existing Re: prefix', () => {
      const seed = buildComposeSeed('reply', { ...BASE_MESSAGE, subject: 'Re: Quarterly numbers' }, IDENTITY)
      expect(seed.subject).toBe('Re: Quarterly numbers')
    })

    it('is case-insensitive when detecting an existing Re: prefix', () => {
      const seed = buildComposeSeed('reply', { ...BASE_MESSAGE, subject: 're: Quarterly numbers' }, IDENTITY)
      expect(seed.subject).toBe('re: Quarterly numbers')
    })

    it('stacks Re: on top of an existing Fwd: prefix rather than treating it as already-replied', () => {
      const seed = buildComposeSeed('reply', { ...BASE_MESSAGE, subject: 'Fwd: Quarterly numbers' }, IDENTITY)
      expect(seed.subject).toBe('Re: Fwd: Quarterly numbers')
    })

    it('handles an empty subject', () => {
      const seed = buildComposeSeed('reply', { ...BASE_MESSAGE, subject: '' }, IDENTITY)
      expect(seed.subject).toBe('Re:')
    })
  })

  describe('replyAll', () => {
    it('leaves Cc empty when the trainee was the only original recipient', () => {
      const seed = buildComposeSeed('replyAll', BASE_MESSAGE, IDENTITY)
      expect(seed.toEmail).toBe('priya@example.com')
      expect(seed.cc).toEqual([])
    })

    it('pre-fills Cc with the other original To recipient when the trainee was not the primary recipient', () => {
      const message: MailMessage = {
        ...BASE_MESSAGE,
        toName: 'Morgan Rivera',
        toEmail: 'morgan@example.com',
        cc: [{ name: 'Jordan Trainee', email: 'jordan.trainee@example.com' }]
      }
      const seed = buildComposeSeed('replyAll', message, IDENTITY)

      expect(seed.toEmail).toBe('priya@example.com')
      expect(seed.cc).toEqual([{ name: 'Morgan Rivera', email: 'morgan@example.com' }])
    })

    it('pre-fills Cc with the other original Cc recipients, excluding the trainee', () => {
      const message: MailMessage = {
        ...BASE_MESSAGE,
        cc: [
          { name: 'Jordan Trainee', email: 'jordan.trainee@example.com' },
          { name: 'Sam Lee', email: 'sam@example.com' }
        ]
      }
      const seed = buildComposeSeed('replyAll', message, IDENTITY)

      expect(seed.cc).toEqual([{ name: 'Sam Lee', email: 'sam@example.com' }])
    })

    it('de-duplicates a recipient appearing in both To and Cc', () => {
      const message: MailMessage = {
        ...BASE_MESSAGE,
        toName: 'Morgan Rivera',
        toEmail: 'morgan@example.com',
        cc: [
          { name: 'Jordan Trainee', email: 'jordan.trainee@example.com' },
          { name: 'Morgan Rivera', email: 'morgan@example.com' }
        ]
      }
      const seed = buildComposeSeed('replyAll', message, IDENTITY)

      expect(seed.cc).toEqual([{ name: 'Morgan Rivera', email: 'morgan@example.com' }])
    })

    it('excludes the original sender from Cc even if they also appear in Cc', () => {
      const message: MailMessage = {
        ...BASE_MESSAGE,
        cc: [{ name: 'Priya Shah', email: 'priya@example.com' }]
      }
      const seed = buildComposeSeed('replyAll', message, IDENTITY)
      expect(seed.cc).toEqual([])
    })
  })

  describe('forward', () => {
    it('clears To and keeps the quoted body', () => {
      const seed = buildComposeSeed('forward', BASE_MESSAGE, IDENTITY)

      expect(seed.toEmail).toBe('')
      expect(seed.toName).toBe('')
      expect(seed.cc).toEqual([])
      expect(seed.body).toContain('> Line one')
      expect(seed.body).toContain('> Line two')
    })

    it('prefixes the subject with Fwd:', () => {
      const seed = buildComposeSeed('forward', BASE_MESSAGE, IDENTITY)
      expect(seed.subject).toBe('Fwd: Quarterly numbers')
    })

    it('does not duplicate an existing Fwd: prefix', () => {
      const seed = buildComposeSeed('forward', { ...BASE_MESSAGE, subject: 'Fwd: Quarterly numbers' }, IDENTITY)
      expect(seed.subject).toBe('Fwd: Quarterly numbers')
    })

    it('stacks Fwd: on top of an existing Re: prefix', () => {
      const seed = buildComposeSeed('forward', { ...BASE_MESSAGE, subject: 'Re: Quarterly numbers' }, IDENTITY)
      expect(seed.subject).toBe('Fwd: Re: Quarterly numbers')
    })
  })
})
