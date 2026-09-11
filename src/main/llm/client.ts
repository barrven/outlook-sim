import type { LlmGenerateInput, LlmGenerateResult, LlmProvider, Settings } from '../../shared/data-types'

interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

function buildRequest(provider: LlmProvider, model: string, apiKey: string, input: LlmGenerateInput): ProviderRequest {
  switch (provider) {
    case 'openai':
    case 'xai':
      return {
        url: provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages: [
            ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
            { role: 'user', content: input.userPrompt }
          ]
        }
      }
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: {
          model,
          max_tokens: 1024,
          ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
          messages: [{ role: 'user', content: input.userPrompt }]
        }
      }
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
          ...(input.systemPrompt
            ? { systemInstruction: { parts: [{ text: input.systemPrompt }] } }
            : {})
        }
      }
  }
}

// Each provider's response shape is only known here; callers never see it.
function extractText(provider: LlmProvider, data: unknown): string {
  const record = data as Record<string, unknown> | null
  switch (provider) {
    case 'openai':
    case 'xai': {
      const choices = record?.choices as Array<{ message?: { content?: string } }> | undefined
      return choices?.[0]?.message?.content ?? ''
    }
    case 'anthropic': {
      const blocks = record?.content as Array<{ type?: string; text?: string }> | undefined
      return blocks?.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('') ?? ''
    }
    case 'gemini': {
      const candidates = record?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
      return candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    }
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  const record = data as { error?: { message?: string } | string; message?: string } | null
  if (typeof record?.error === 'string') return record.error
  if (record?.error?.message) return record.error.message
  if (record?.message) return record.message
  return fallback
}

/**
 * Provider-agnostic entry point: calling code passes a prompt and gets back
 * generated text or a human-readable error, never a provider-specific
 * response shape or a thrown exception.
 */
export async function generateText(settings: Settings, input: LlmGenerateInput): Promise<LlmGenerateResult> {
  const apiKey = settings.apiKeys[settings.provider]
  if (!apiKey) {
    return { ok: false, error: `No API key configured for ${settings.provider}.` }
  }
  if (!settings.model) {
    return { ok: false, error: 'No model configured.' }
  }

  const request = buildRequest(settings.provider, settings.model, apiKey, input)

  let response: Response
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body)
    })
  } catch (error) {
    return { ok: false, error: `Network error: ${error instanceof Error ? error.message : String(error)}` }
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON body (e.g. an HTML error page); fall through with data = null.
  }

  if (!response.ok) {
    const message = extractErrorMessage(data, response.statusText || `HTTP ${response.status}`)
    return { ok: false, error: `${settings.provider} API error (${response.status}): ${message}` }
  }

  const text = extractText(settings.provider, data)
  if (!text) {
    return { ok: false, error: 'The provider returned no text.' }
  }
  return { ok: true, text }
}
