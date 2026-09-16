import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MailDb } from '../data/db'
import { buildFileVineContextPrompt } from './fileVineContext'

describe('buildFileVineContextPrompt', () => {
  let baseDir: string
  let db: MailDb

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-filevine-context-'))
    db = new MailDb(baseDir)
  })

  afterEach(() => {
    db.close()
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('returns null when the persona has no associated folder', () => {
    db.createFileVineFolder({ name: 'Someone Else\'s Matter', parentId: null, clientPersonaId: 'other-persona' })

    expect(buildFileVineContextPrompt(db, 'persona-1')).toBeNull()
  })

  it('returns null when there are no FileVine folders at all', () => {
    expect(buildFileVineContextPrompt(db, 'persona-1')).toBeNull()
  })

  it('includes the folder name and every note\'s name + content', () => {
    const folder = db.createFileVineFolder({ name: 'Smith v. Jones', parentId: null, clientPersonaId: 'persona-1' })
    db.createFileVineNote({ folderId: folder.id, name: 'Intake notes', content: 'Client injured on 2026-01-05.' })
    db.createFileVineNote({ folderId: folder.id, name: 'Medical records', content: 'Treated at County General.' })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')

    expect(prompt).toContain('Smith v. Jones')
    expect(prompt).toContain('Intake notes')
    expect(prompt).toContain('Client injured on 2026-01-05.')
    expect(prompt).toContain('Medical records')
    expect(prompt).toContain('Treated at County General.')
  })

  it('aggregates every folder associated with the persona, not just the first', () => {
    const folderA = db.createFileVineFolder({ name: 'Matter A', parentId: null, clientPersonaId: 'persona-1' })
    const folderB = db.createFileVineFolder({ name: 'Matter B', parentId: null, clientPersonaId: 'persona-1' })
    db.createFileVineNote({ folderId: folderA.id, name: 'Note A', content: 'Content A' })
    db.createFileVineNote({ folderId: folderB.id, name: 'Note B', content: 'Content B' })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')

    expect(prompt).toContain('Matter A')
    expect(prompt).toContain('Content A')
    expect(prompt).toContain('Matter B')
    expect(prompt).toContain('Content B')
  })

  it('excludes a folder associated with a different persona', () => {
    const mine = db.createFileVineFolder({ name: 'Mine', parentId: null, clientPersonaId: 'persona-1' })
    const theirs = db.createFileVineFolder({ name: 'Theirs', parentId: null, clientPersonaId: 'persona-2' })
    db.createFileVineNote({ folderId: mine.id, name: 'My note', content: 'My content' })
    db.createFileVineNote({ folderId: theirs.id, name: 'Their note', content: 'Their content' })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')

    expect(prompt).toContain('Mine')
    expect(prompt).not.toContain('Theirs')
    expect(prompt).not.toContain('Their content')
  })

  it('AC1: names a folder with no notes yet explicitly, rather than omitting it', () => {
    db.createFileVineFolder({ name: 'Empty Matter', parentId: null, clientPersonaId: 'persona-1' })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')

    expect(prompt).toContain('Empty Matter')
    expect(prompt).toContain('no notes/files yet')
  })

  it('AC1: truncates a very large note rather than including it in full', () => {
    const folder = db.createFileVineFolder({ name: 'Big Matter', parentId: null, clientPersonaId: 'persona-1' })
    const hugeContent = 'x'.repeat(10_000)
    db.createFileVineNote({ folderId: folder.id, name: 'Huge note', content: hugeContent })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')!

    expect(prompt.length).toBeLessThan(hugeContent.length)
    expect(prompt).toContain('[...truncated]')
  })

  it('does not truncate a note within the size cap', () => {
    const folder = db.createFileVineFolder({ name: 'Small Matter', parentId: null, clientPersonaId: 'persona-1' })
    const content = 'y'.repeat(500)
    db.createFileVineNote({ folderId: folder.id, name: 'Small note', content })

    const prompt = buildFileVineContextPrompt(db, 'persona-1')!

    expect(prompt).toContain(content)
    expect(prompt).not.toContain('[...truncated]')
  })

  it('AC4: reflects a note update immediately (no caching) — two calls in a row see different content', () => {
    const folder = db.createFileVineFolder({ name: 'Matter', parentId: null, clientPersonaId: 'persona-1' })
    const note = db.createFileVineNote({ folderId: folder.id, name: 'Note', content: 'Original' })

    expect(buildFileVineContextPrompt(db, 'persona-1')).toContain('Original')

    db.updateFileVineNote(note.id, { content: 'Updated' })

    const secondPrompt = buildFileVineContextPrompt(db, 'persona-1')!
    expect(secondPrompt).toContain('Updated')
    expect(secondPrompt).not.toContain('Original')
  })
})
