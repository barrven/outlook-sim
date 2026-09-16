import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfigStore } from './config'

describe('ConfigStore', () => {
  let baseDir: string
  let config: ConfigStore

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-config-'))
    config = new ConfigStore(baseDir)
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('creates all five config files with empty defaults on first run', () => {
    const configDir = join(baseDir, 'config')
    for (const file of ['settings.json', 'system-prompt.json', 'identity.json', 'personas.json', 'scheduler.json']) {
      expect(existsSync(join(configDir, file))).toBe(true)
    }

    expect(config.getSettings()).toEqual({
      provider: 'openai',
      model: '',
      apiKeys: { openai: '', anthropic: '', gemini: '', xai: '' }
    })
    expect(config.getSystemPrompt()).toEqual({ systemPrompt: '' })
    expect(config.getIdentity()).toEqual({
      displayName: '',
      jobTitle: '',
      fromEmail: '',
      reportsTo: '',
      department: ''
    })
    expect(config.getPersonas()).toEqual([])
    expect(config.getSchedulerState()).toEqual({ nextDueSimTime: 0 })
  })

  it('writes real JSON to disk, not just in-memory state', () => {
    config.setSystemPrompt({ systemPrompt: 'You work at a law firm.' })
    const raw = readFileSync(join(baseDir, 'config', 'system-prompt.json'), 'utf-8')
    expect(JSON.parse(raw)).toEqual({ systemPrompt: 'You work at a law firm.' })
  })

  it('round-trips settings', () => {
    config.setSettings({
      provider: 'anthropic',
      model: 'claude-x',
      apiKeys: { openai: '', anthropic: 'sk-test', gemini: '', xai: '' }
    })
    expect(config.getSettings().provider).toBe('anthropic')
    expect(config.getSettings().apiKeys.anthropic).toBe('sk-test')
  })

  it('round-trips trainee identity', () => {
    config.setIdentity({
      displayName: 'Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'trainee@example.com',
      reportsTo: 'Patricia Sim',
      department: 'Litigation'
    })
    expect(config.getIdentity()).toEqual({
      displayName: 'Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'trainee@example.com',
      reportsTo: 'Patricia Sim',
      department: 'Litigation'
    })
  })

  it('round-trips personas', () => {
    config.setPersonas([
      {
        id: 'p1',
        displayName: 'Carol',
        email: 'carol@example.com',
        role: 'Partner',
        bio: 'Senior partner',
        writingStyleNotes: 'Terse, direct',
        extraPrompt: '',
        isClient: true,
        reportsTo: ''
      }
    ])
    expect(config.getPersonas()).toHaveLength(1)
    expect(config.getPersonas()[0].displayName).toBe('Carol')
  })

  it('round-trips scheduler state', () => {
    config.setSchedulerState({ nextDueSimTime: 123456789 })
    expect(config.getSchedulerState()).toEqual({ nextDueSimTime: 123456789 })
  })

  it('persists all five stores across a close/reopen cycle', () => {
    config.setSettings({
      provider: 'gemini',
      model: 'gemini-x',
      apiKeys: { openai: '', anthropic: '', gemini: 'sk-gemini', xai: '' }
    })
    config.setSystemPrompt({ systemPrompt: 'Domain: insurance office.' })
    config.setIdentity({
      displayName: 'Trainee Two',
      jobTitle: 'Adjuster',
      fromEmail: 't2@example.com',
      reportsTo: '',
      department: ''
    })
    config.setPersonas([
      {
        id: 'p2',
        displayName: 'Dana',
        email: 'dana@example.com',
        role: 'Manager',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: 'Always mention the deadline.',
        isClient: false,
        reportsTo: ''
      }
    ])
    config.setSchedulerState({ nextDueSimTime: 555 })

    const reopened = new ConfigStore(baseDir)
    expect(reopened.getSettings().provider).toBe('gemini')
    expect(reopened.getSystemPrompt().systemPrompt).toBe('Domain: insurance office.')
    expect(reopened.getIdentity().displayName).toBe('Trainee Two')
    expect(reopened.getPersonas()).toEqual(config.getPersonas())
    expect(reopened.getSchedulerState()).toEqual({ nextDueSimTime: 555 })
  })

  // Org-structure fields (feature 028)

  it('028 AC1/AC3: identity reportsTo/department persist across a close/reopen cycle', () => {
    config.setIdentity({
      displayName: 'Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'trainee@example.com',
      reportsTo: 'Patricia Sim',
      department: 'Litigation'
    })

    const reopened = new ConfigStore(baseDir)
    expect(reopened.getIdentity()).toEqual({
      displayName: 'Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'trainee@example.com',
      reportsTo: 'Patricia Sim',
      department: 'Litigation'
    })
  })

  it('028 AC2/AC3: persona reportsTo persists across a close/reopen cycle', () => {
    config.setPersonas([
      {
        id: 'p1',
        displayName: 'Carlos Torres',
        email: 'c.torres@email.test',
        role: '',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: '',
        isClient: true,
        reportsTo: 'Michael Ferrante'
      }
    ])

    const reopened = new ConfigStore(baseDir)
    expect(reopened.getPersonas()[0].reportsTo).toBe('Michael Ferrante')
  })

  it('028 AC3: both new fields are optional — empty is valid and round-trips as empty', () => {
    config.setIdentity({
      displayName: 'Trainee',
      jobTitle: '',
      fromEmail: 'trainee@example.com',
      reportsTo: '',
      department: ''
    })
    config.setPersonas([
      {
        id: 'p1',
        displayName: 'Carol',
        email: 'carol@example.com',
        role: '',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: '',
        isClient: false,
        reportsTo: ''
      }
    ])

    expect(config.getIdentity().reportsTo).toBe('')
    expect(config.getIdentity().department).toBe('')
    expect(config.getPersonas()[0].reportsTo).toBe('')
  })

  it('028 AC4: identity.json saved before this feature (missing reportsTo/department) loads without error, defaulting to empty', () => {
    writeFileSync(
      join(baseDir, 'config', 'identity.json'),
      JSON.stringify({ displayName: 'Legacy Trainee', jobTitle: 'Analyst', fromEmail: 'legacy@example.com' })
    )

    const reopened = new ConfigStore(baseDir)

    expect(() => reopened.getIdentity()).not.toThrow()
    expect(reopened.getIdentity()).toEqual({
      displayName: 'Legacy Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'legacy@example.com',
      reportsTo: '',
      department: ''
    })
  })

  it('028 AC4: personas.json saved before this feature (missing reportsTo) loads without error, defaulting to empty', () => {
    writeFileSync(
      join(baseDir, 'config', 'personas.json'),
      JSON.stringify({
        personas: [
          {
            id: 'legacy-1',
            displayName: 'Legacy Persona',
            email: 'legacy@example.com',
            role: 'Manager',
            bio: '',
            writingStyleNotes: '',
            extraPrompt: '',
            isClient: false
          }
        ]
      })
    )

    const reopened = new ConfigStore(baseDir)

    expect(() => reopened.getPersonas()).not.toThrow()
    expect(reopened.getPersonas()).toEqual([
      {
        id: 'legacy-1',
        displayName: 'Legacy Persona',
        email: 'legacy@example.com',
        role: 'Manager',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: '',
        isClient: false,
        reportsTo: ''
      }
    ])
  })

  // LLM failure log (feature 027)

  it('027 AC4: starts with an empty failure log', () => {
    expect(config.getLlmFailureLog()).toEqual([])
  })

  it('027 AC4: appends failure log entries in order, without overwriting earlier ones', () => {
    config.appendLlmFailureLog({ timestamp: 1000, source: 'personaReply', error: 'first' })
    config.appendLlmFailureLog({ timestamp: 2000, source: 'testConnection', error: 'second' })
    config.appendLlmFailureLog({ timestamp: 3000, source: 'unsolicitedMail', error: 'third' })

    expect(config.getLlmFailureLog()).toEqual([
      { timestamp: 1000, source: 'personaReply', error: 'first' },
      { timestamp: 2000, source: 'testConnection', error: 'second' },
      { timestamp: 3000, source: 'unsolicitedMail', error: 'third' }
    ])
  })

  it('027 AC4: the failure log survives a close/reopen cycle', () => {
    config.appendLlmFailureLog({ timestamp: 1000, source: 'personaReply', error: 'boom' })

    const reopened = new ConfigStore(baseDir)
    expect(reopened.getLlmFailureLog()).toEqual([{ timestamp: 1000, source: 'personaReply', error: 'boom' }])
  })
})
