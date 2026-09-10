import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
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

  it('creates all four config files with empty defaults on first run', () => {
    const configDir = join(baseDir, 'config')
    for (const file of ['settings.json', 'system-prompt.json', 'identity.json', 'personas.json']) {
      expect(existsSync(join(configDir, file))).toBe(true)
    }

    expect(config.getSettings()).toEqual({
      provider: 'openai',
      model: '',
      apiKeys: { openai: '', anthropic: '', gemini: '', xai: '' }
    })
    expect(config.getSystemPrompt()).toEqual({ systemPrompt: '' })
    expect(config.getIdentity()).toEqual({ displayName: '', jobTitle: '', fromEmail: '' })
    expect(config.getPersonas()).toEqual([])
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
    config.setIdentity({ displayName: 'Trainee', jobTitle: 'Analyst', fromEmail: 'trainee@example.com' })
    expect(config.getIdentity()).toEqual({
      displayName: 'Trainee',
      jobTitle: 'Analyst',
      fromEmail: 'trainee@example.com'
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
        extraPrompt: ''
      }
    ])
    expect(config.getPersonas()).toHaveLength(1)
    expect(config.getPersonas()[0].displayName).toBe('Carol')
  })

  it('persists all four stores across a close/reopen cycle', () => {
    config.setSettings({
      provider: 'gemini',
      model: 'gemini-x',
      apiKeys: { openai: '', anthropic: '', gemini: 'sk-gemini', xai: '' }
    })
    config.setSystemPrompt({ systemPrompt: 'Domain: insurance office.' })
    config.setIdentity({ displayName: 'Trainee Two', jobTitle: 'Adjuster', fromEmail: 't2@example.com' })
    config.setPersonas([
      {
        id: 'p2',
        displayName: 'Dana',
        email: 'dana@example.com',
        role: 'Manager',
        bio: '',
        writingStyleNotes: '',
        extraPrompt: 'Always mention the deadline.'
      }
    ])

    const reopened = new ConfigStore(baseDir)
    expect(reopened.getSettings().provider).toBe('gemini')
    expect(reopened.getSystemPrompt().systemPrompt).toBe('Domain: insurance office.')
    expect(reopened.getIdentity().displayName).toBe('Trainee Two')
    expect(reopened.getPersonas()).toEqual(config.getPersonas())
  })
})
