import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonasFilePersona } from '../../shared/data-types'
import { ConfigStore } from '../data/config'
import { generatePersonas } from './generatePersonas'

const CAST: PersonasFilePersona[] = [
  {
    displayName: 'Alice Chen',
    email: 'alice@firm.com',
    role: 'Partner',
    bio: 'Senior partner leading the litigation group.',
    writingStyleNotes: 'Formal, concise.',
    extraPrompt: '',
    isClient: false,
    reportsTo: ''
  },
  {
    displayName: 'Bob Diaz',
    email: 'bob@firm.com',
    role: 'Associate',
    bio: 'Junior associate.',
    writingStyleNotes: 'Casual, chatty.',
    extraPrompt: '',
    isClient: false,
    reportsTo: 'Alice Chen'
  }
]

function jsonResponse(content: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ choices: [{ message: { content } }] })
  } as Response
}

describe('generatePersonas', () => {
  let baseDir: string
  let config: ConfigStore

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'outlook-sim-generate-personas-'))
    config = new ConfigStore(baseDir)
    config.setSettings({
      provider: 'openai',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-test', anthropic: '', gemini: '', xai: '' }
    })
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  // AC1: uses the currently configured provider/model/key, the same
  // persisted Settings every other LLM call reads via `config.getSettings()`.
  it('AC1: calls the provider configured in Settings, not any caller-supplied value', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(JSON.stringify(CAST)))

    await generatePersonas(config, 'a small law firm')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('gpt-4o')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-test' })
  })

  // AC1: the free-text description is what the model is asked to respond to.
  it('AC1: passes the free-text description through as the user prompt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(JSON.stringify(CAST)))

    await generatePersonas(config, 'a mid-size personal injury law firm in Chicago')

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages.at(-1)).toEqual({
      role: 'user',
      content: 'a mid-size personal injury law firm in Chicago'
    })
  })

  // AC2: a successful generation produces well-formed personas (all fields
  // populated) with reports-to relationships preserved, ready to be shown
  // to the user before commit — this call itself never touches persisted
  // config, so "before commit" is enforced entirely by the caller.
  it('AC2: parses a well-formed response into fully-populated persona entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(JSON.stringify(CAST)))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: true, personas: CAST })
  })

  // AC2: reports-to relationships forming a sensible structure — a second
  // persona's reportsTo referencing the first persona's displayName must
  // survive parsing unchanged, not be dropped or reset.
  it('AC2: preserves reportsTo relationships between generated personas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(JSON.stringify(CAST)))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.personas[0].reportsTo).toBe('')
      expect(result.personas[1].reportsTo).toBe('Alice Chen')
    }
  })

  // Providers sometimes wrap JSON in a markdown code fence despite being
  // told not to; this must still parse cleanly.
  it('AC2: strips a markdown code fence the provider wraps the JSON in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse('```json\n' + JSON.stringify(CAST) + '\n```'))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: true, personas: CAST })
  })

  // Providers sometimes add commentary after the closing fence (e.g. "Hope
  // this helps!"), which broke the old fence regex anchored to end-of-string.
  it('AC2: strips a markdown code fence followed by trailing commentary', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse('```json\n' + JSON.stringify(CAST) + '\n```\nHope this helps!')
    )

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: true, personas: CAST })
  })

  // Providers sometimes add leading commentary before the opening fence.
  it('AC2: strips a markdown code fence preceded by leading commentary', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse('Sure, here you go:\n```json\n' + JSON.stringify(CAST) + '\n```')
    )

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: true, personas: CAST })
  })

  // A fence without the "json" language tag must still be stripped.
  it('AC2: strips a markdown code fence with no json language tag', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse('```\n' + JSON.stringify(CAST) + '\n```'))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: true, personas: CAST })
  })

  // AC4: a network/API-level failure comes back as a clear error, not a throw.
  it('AC4: a network error surfaces as a clear error result rather than throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({ ok: false, error: 'Network error: boom' })
  })

  // AC4: a bad key (provider rejects the request) is a clear error.
  it('AC4: a provider auth error surfaces as a clear error result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: { message: 'Incorrect API key provided' } })
    } as Response)

    const result = await generatePersonas(config, 'a small law firm')

    expect(result).toEqual({
      ok: false,
      error: 'openai API error (401): Incorrect API key provided'
    })
  })

  // AC4: malformed LLM output (not JSON at all) is a clear error, not a throw.
  it('AC4: non-JSON provider output surfaces as a clear error result rather than throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse('Sure! Here are some personas for you.'))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/)
  })

  // AC4: malformed LLM output (valid JSON, wrong shape) is a clear,
  // specific error, not a throw — same per-field validation 031's
  // `validatePersonasFile` already gives a bad hand-edited file.
  it('AC4: well-formed JSON missing a required field surfaces a specific validation error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(JSON.stringify([{ email: 'no-name@firm.com' }])))

    const result = await generatePersonas(config, 'a small law firm')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/displayName/)
  })

  // AC4: a failed generation must never touch the persisted persona list —
  // this call takes no dependency on it at all (only `config.getSettings()`
  // and `config.getSystemPrompt()`), so a failure structurally can't mutate
  // it; asserted explicitly to pin that invariant.
  it('AC4: never reads or writes the persisted persona list on failure', async () => {
    config.setPersonas([{ id: 'p1', displayName: 'Existing', email: 'e@x.com', role: '', bio: '', writingStyleNotes: '', extraPrompt: '', isClient: false, reportsTo: '' }])
    const before = config.getPersonas()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))

    await generatePersonas(config, 'a small law firm')

    expect(config.getPersonas()).toEqual(before)
  })
})
