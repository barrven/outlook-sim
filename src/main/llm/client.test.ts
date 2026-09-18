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

  describe('multimodal image attachments (feature 064)', () => {
    const IMAGE = { mimeType: 'image/png', base64Data: 'ZmFrZS1wbmctYnl0ZXM=' }

    it('AC1: sends an image as an OpenAI-style image_url content block alongside the text', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'reply' } }] }))

      await generateText(baseSettings('openai'), { userPrompt: 'Hi', images: [IMAGE] })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.messages[0]).toEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'Hi' },
          { type: 'image_url', image_url: { url: `data:${IMAGE.mimeType};base64,${IMAGE.base64Data}` } }
        ]
      })
    })

    it('AC1: sends an image as an xAI (Grok) image_url content block, OpenAI-compatible', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'reply' } }] }))

      await generateText(baseSettings('xai'), { userPrompt: 'Hi', images: [IMAGE] })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.messages[0].content).toContainEqual({
        type: 'image_url',
        image_url: { url: `data:${IMAGE.mimeType};base64,${IMAGE.base64Data}` }
      })
    })

    it('AC1: sends an image as an Anthropic base64 image source block alongside the text', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, { content: [{ type: 'text', text: 'reply' }] }))

      await generateText(baseSettings('anthropic'), { userPrompt: 'Hi', images: [IMAGE] })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.messages[0]).toEqual({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: IMAGE.mimeType, data: IMAGE.base64Data } },
          { type: 'text', text: 'Hi' }
        ]
      })
    })

    it('AC1: sends an image as a Gemini inline_data part alongside the text', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'reply' }] } }] })
      )

      await generateText(baseSettings('gemini'), { userPrompt: 'Hi', images: [IMAGE] })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.contents[0].parts).toEqual([
        { text: 'Hi' },
        { inline_data: { mime_type: IMAGE.mimeType, data: IMAGE.base64Data } }
      ])
    })

    it('sends plain string content (no array) when there are no images, unchanged from before this feature', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'reply' } }] }))

      await generateText(baseSettings('openai'), { userPrompt: 'Hi', images: [] })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.messages[0].content).toBe('Hi')
    })

    it('AC2: retries once without images when the first (with-image) attempt fails, returning a clean success', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse(400, { error: { message: 'image content not supported by this model' } }))
        .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: 'clean reply, no image' } }] }))

      const result = await generateText(baseSettings('openai'), { userPrompt: 'Hi', images: [IMAGE] })

      expect(result).toEqual({ ok: true, text: 'clean reply, no image' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      const secondBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string)
      expect(secondBody.messages[0].content).toBe('Hi')
    })

    it('AC2: if the image-less retry also fails, surfaces that failure rather than throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(401, { error: { message: 'bad key' } }))

      const result = await generateText(baseSettings('openai'), { userPrompt: 'Hi', images: [IMAGE] })

      expect(result).toEqual({ ok: false, error: 'openai API error (401): bad key' })
    })

    it('does not retry when there are no images to begin with (an unrelated failure stays a single attempt)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, { error: 'boom' }))

      await generateText(baseSettings('openai'), { userPrompt: 'Hi' })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
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
