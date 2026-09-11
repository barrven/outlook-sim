import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LlmProvider, Settings } from '../../shared/data-types'
import { generateText } from './client'

function baseSettings(provider: LlmProvider, overrides: Partial<Settings> = {}): Settings {
  return {
    provider,
    model: 'test-model',
    apiKeys: { openai: '', anthropic: '', gemini: '', xai: '', [provider]: 'test-key' },
    ...overrides
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body)
  } as Response
}

describe('generateText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the OpenAI chat completions endpoint and extracts the reply', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'Hello there' } }] }))

    const result = await generateText(baseSettings('openai'), { systemPrompt: 'Be terse.', userPrompt: 'Hi' })

    expect(result).toEqual({ ok: true, text: 'Hello there' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe('test-model')
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'Hi' }
    ])
  })

  it('calls the xAI (Grok) chat completions endpoint, OpenAI-compatible', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'Grok says hi' } }] }))

    const result = await generateText(baseSettings('xai'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: true, text: 'Grok says hi' })
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.x.ai/v1/chat/completions')
  })

  it('calls the Anthropic messages endpoint and extracts the reply', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { content: [{ type: 'text', text: 'Hello from Claude' }] })
    )

    const result = await generateText(baseSettings('anthropic'), { systemPrompt: 'Be terse.', userPrompt: 'Hi' })

    expect(result).toEqual({ ok: true, text: 'Hello from Claude' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(init?.body as string)
    expect(body.system).toBe('Be terse.')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('calls the Gemini generateContent endpoint and extracts the reply', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }] })
    )

    const result = await generateText(baseSettings('gemini'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: true, text: 'Hello from Gemini' })
    const [url] = fetchSpy.mock.calls[0]
    expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent?key=')
  })

  it('returns a clear error without throwing when the API key is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generateText(
      { provider: 'openai', model: 'gpt-4o', apiKeys: { openai: '', anthropic: '', gemini: '', xai: '' } },
      { userPrompt: 'Hi' }
    )

    expect(result).toEqual({ ok: false, error: 'No API key configured for openai.' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns a clear error without throwing when the model is missing', async () => {
    const result = await generateText(baseSettings('openai', { model: '' }), { userPrompt: 'Hi' })
    expect(result).toEqual({ ok: false, error: 'No model configured.' })
  })

  it('returns a clear error on a bad-key (401) response instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: { message: 'Incorrect API key provided.' } })
    )

    const result = await generateText(baseSettings('openai'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: false, error: 'openai API error (401): Incorrect API key provided.' })
  })

  it('returns a clear error on a rate-limit (429) response instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(429, { error: { message: 'Rate limit exceeded' } }))

    const result = await generateText(baseSettings('anthropic'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: false, error: 'anthropic API error (429): Rate limit exceeded' })
  })

  it('returns a clear error on a network failure instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const result = await generateText(baseSettings('gemini'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: false, error: 'Network error: fetch failed' })
  })

  it('returns a clear error when the provider responds with no text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { choices: [] }))

    const result = await generateText(baseSettings('openai'), { userPrompt: 'Hi' })

    expect(result).toEqual({ ok: false, error: 'The provider returned no text.' })
  })

  it('exposes one identical call shape and result shape across all four providers', async () => {
    // Same (settings, input) -> Promise<{ok,text}|{ok,error}> call regardless of provider: this is
    // the whole of what a caller (e.g. the persona-reply feature) needs to know.
    const providerResponses: Record<LlmProvider, unknown> = {
      openai: { choices: [{ message: { content: 'reply' } }] },
      xai: { choices: [{ message: { content: 'reply' } }] },
      anthropic: { content: [{ type: 'text', text: 'reply' }] },
      gemini: { candidates: [{ content: { parts: [{ text: 'reply' }] } }] }
    }

    for (const provider of Object.keys(providerResponses) as LlmProvider[]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, providerResponses[provider]))

      const result = await generateText(baseSettings(provider), { systemPrompt: 'sys', userPrompt: 'Hi' })

      expect(result).toEqual({ ok: true, text: 'reply' })
      vi.restoreAllMocks()
    }
  })
})
