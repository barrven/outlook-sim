import type { GeneratePersonasResult } from '../../shared/data-types'
import { validatePersonasFile } from '../data/personasFile'
import type { ConfigStore } from '../data/config'
import { generateText } from './client'

function buildSystemPrompt(systemPrompt: string): string {
  return [
    systemPrompt,
    'You are generating a cast of email personas for a corporate email-simulation training tool, based on a company/industry description the user provides.',
    'Respond with ONLY a JSON array (no markdown code fences, no commentary before or after) of persona objects. Each object must have exactly these fields:',
    '- displayName (string): full name',
    '- email (string): a plausible work email address',
    '- role (string): job title',
    '- bio (string): a short background',
    '- writingStyleNotes (string): notes on how this person writes emails',
    '- extraPrompt (string): additional guidance for playing this persona, may be an empty string',
    '- isClient (boolean): true if this person is an external client of the firm rather than internal staff',
    "- reportsTo (string): another generated persona's exact displayName this person reports to, or an empty string for the most senior persona(s)",
    "Generate a sensible-sized cast (roughly 4-8 personas) whose reportsTo values reference each other's displayName to form a coherent, acyclic reporting structure — not a flat list where everyone reports to no one."
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Providers sometimes wrap JSON output in a markdown code fence despite
// being told not to; stripping it here keeps parsing lenient without
// weakening the "respond with ONLY JSON" instruction itself. The fence is
// searched for anywhere in the response (not anchored to the whole trimmed
// string) since providers also sometimes add leading/trailing commentary
// around the fence.
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) {
    return fenced[1]
  }
  // No closing fence (e.g. a truncated response) — still strip a leading
  // opening fence so JSON.parse sees the payload rather than the backticks.
  const openingOnly = trimmed.match(/^```(?:json)?\s*([\s\S]*)$/i)
  return openingOnly ? openingOnly[1] : trimmed
}

/**
 * Asks the configured LLM to generate a full persona cast from a free-text
 * company/industry description (feature 032). Reuses `validatePersonasFile`
 * for shape validation — the model is instructed to produce exactly a
 * personas-file-shaped JSON array, so a malformed or incomplete response is
 * caught the same way a bad hand-edited import file would be: a clear
 * error, never a throw, never partially applied.
 */
export async function generatePersonas(config: ConfigStore, description: string): Promise<GeneratePersonasResult> {
  const { systemPrompt } = config.getSystemPrompt()

  const result = await generateText(config.getSettings(), {
    systemPrompt: buildSystemPrompt(systemPrompt),
    userPrompt: description
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  let data: unknown
  try {
    data = JSON.parse(stripCodeFence(result.text))
  } catch (error) {
    return { ok: false, error: `Provider response was not valid JSON: ${(error as Error).message}` }
  }

  return validatePersonasFile(data)
}
