import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MailDb } from '../data/db'
import { buildMatterContextPrompt } from './matterContext'

describe('buildMatterContextPrompt', () => {
  let baseDir: string
  let db: MailDb

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-matter-context-'))
    db = new MailDb(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('returns null when no matter is linked to the persona', () => {
    db.createGpMatter({ clientName: 'Someone Else', clientPersonaId: 'other-persona' })

    expect(buildMatterContextPrompt(db, 'persona-1')).toBeNull()
  })

  it('returns null when there are no matters at all', () => {
    expect(buildMatterContextPrompt(db, 'persona-1')).toBeNull()
  })

  it('includes the linked matter\'s number, key facts, summary, and each document\'s name and content', () => {
    const matter = db.createGpMatter({
      clientName: 'Rivera, Ana',
      clientPersonaId: 'persona-1',
      dateOfLoss: '2026-01-05',
      insurerCompany: 'Northern Mutual',
      claimNumber: 'CLM-55812',
      injuryTrack: 'MIG',
      summary: 'Client in physio twice a week; IRB ongoing.'
    })
    db.createGpDocument({ matterId: matter.id, name: 'Intake notes', content: 'Rear-ended at a red light.' })
    db.createGpDocument({ matterId: matter.id, name: 'OCF-3', content: 'Disability certificate.' })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!

    expect(prompt).toContain('Ghost Practice')
    expect(prompt).toContain(matter.matterNumber)
    expect(prompt).toContain('Rivera, Ana')
    expect(prompt).toContain('Date of loss: 2026-01-05')
    expect(prompt).toContain('Insurer: Northern Mutual')
    expect(prompt).toContain('Claim #: CLM-55812')
    expect(prompt).toContain('Injury track: MIG')
    expect(prompt).toContain('Status: Intake')
    expect(prompt).toContain('File summary: Client in physio twice a week; IRB ongoing.')
    expect(prompt).toContain('- Intake notes:\nRear-ended at a red light.')
    expect(prompt).toContain('- OCF-3:\nDisability certificate.')
  })

  it('leaves out facts that have not been filled in', () => {
    db.createGpMatter({ clientName: 'Rivera, Ana', clientPersonaId: 'persona-1' })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!

    expect(prompt).not.toContain('Date of loss')
    expect(prompt).not.toContain('Insurer')
    expect(prompt).not.toContain('File summary')
  })

  it('combines every matter linked to the persona, and none linked to anyone else', () => {
    const first = db.createGpMatter({ clientName: 'First accident', clientPersonaId: 'persona-1' })
    const second = db.createGpMatter({ clientName: 'Second accident', clientPersonaId: 'persona-1' })
    const theirs = db.createGpMatter({ clientName: 'Theirs', clientPersonaId: 'persona-2' })
    db.createGpDocument({ matterId: first.id, name: 'Note A', content: 'Content A' })
    db.createGpDocument({ matterId: second.id, name: 'Note B', content: 'Content B' })
    db.createGpDocument({ matterId: theirs.id, name: 'Their note', content: 'Their content' })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!

    expect(prompt).toContain('First accident')
    expect(prompt).toContain('Content A')
    expect(prompt).toContain('Second accident')
    expect(prompt).toContain('Content B')
    expect(prompt).not.toContain('Theirs')
    expect(prompt).not.toContain('Their content')
  })

  it('says so explicitly when a linked matter has no documents yet', () => {
    db.createGpMatter({ clientName: 'Empty file', clientPersonaId: 'persona-1' })

    expect(buildMatterContextPrompt(db, 'persona-1')).toContain('No documents on this file yet.')
  })

  it('lists an uploaded file with no extracted text by name only', () => {
    const matter = db.createGpMatter({ clientName: 'Rivera, Ana', clientPersonaId: 'persona-1' })
    db.createGpDocument({ matterId: matter.id, name: 'photo.jpg', content: '', path: '/tmp/photo.jpg' })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!

    expect(prompt).toContain('- photo.jpg')
    expect(prompt).not.toContain('- photo.jpg:')
  })

  it('truncates a document longer than 4000 characters, and leaves a shorter one whole', () => {
    const matter = db.createGpMatter({ clientName: 'Rivera, Ana', clientPersonaId: 'persona-1' })
    db.createGpDocument({ matterId: matter.id, name: 'Huge', content: 'x'.repeat(4000) + 'OVERFLOW' })
    db.createGpDocument({ matterId: matter.id, name: 'Small', content: 'y'.repeat(4000) })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!

    expect(prompt).toContain('[...truncated]')
    expect(prompt).not.toContain('OVERFLOW')
    expect(prompt).toContain('y'.repeat(4000))
    expect(prompt.match(/\[\.\.\.truncated\]/g)).toHaveLength(1)
  })

  it('re-reads on every call, so an edit shows up immediately', () => {
    const matter = db.createGpMatter({ clientName: 'Rivera, Ana', clientPersonaId: 'persona-1' })
    const document = db.createGpDocument({ matterId: matter.id, name: 'Note', content: 'Original' })
    expect(buildMatterContextPrompt(db, 'persona-1')).toContain('Original')

    db.updateGpDocument(document.id, { content: 'Updated' })

    const prompt = buildMatterContextPrompt(db, 'persona-1')!
    expect(prompt).toContain('Updated')
    expect(prompt).not.toContain('Original')
  })
})
