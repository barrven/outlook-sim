import type { PersonasFilePersona, PersonasFileValidationResult } from '../../shared/data-types'

class PersonasFileValidationError extends Error {}

// Deliberately self-contained rather than sharing `scenarioPack.ts`'s
// private validation helpers — same small set of primitives (object/
// string/optional-string/optional-boolean), but this feature's file
// format doesn't need `scenarioPack.ts`'s array/number helpers, and
// duplicating ~15 lines here avoids touching that already-tested module.
function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PersonasFileValidationError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new PersonasFileValidationError(`${path} must be a string`)
  return value
}

function optionalString(value: unknown, path: string, fallback = ''): string {
  if (value === undefined) return fallback
  return requireString(value, path)
}

function optionalBoolean(value: unknown, path: string, fallback = false): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new PersonasFileValidationError(`${path} must be a boolean`)
  return value
}

function parsePersonaEntry(value: unknown, index: number): PersonasFilePersona {
  const path = `personas[${index}]`
  const obj = requireObject(value, path)
  return {
    displayName: requireString(obj.displayName, `${path}.displayName`),
    email: requireString(obj.email, `${path}.email`),
    role: optionalString(obj.role, `${path}.role`),
    bio: optionalString(obj.bio, `${path}.bio`),
    writingStyleNotes: optionalString(obj.writingStyleNotes, `${path}.writingStyleNotes`),
    extraPrompt: optionalString(obj.extraPrompt, `${path}.extraPrompt`),
    isClient: optionalBoolean(obj.isClient, `${path}.isClient`),
    reportsTo: optionalString(obj.reportsTo, `${path}.reportsTo`)
  }
}

/**
 * Validates and normalizes an arbitrary JSON value into a list of
 * personas-file entries, never throwing — a malformed file comes back as
 * a clear, specific error message (which entry, which field, what's
 * wrong) rather than a crash (feature 031 AC3). The file is a bare JSON
 * array — distinct from a scenario pack's wrapping object.
 */
export function validatePersonasFile(data: unknown): PersonasFileValidationResult {
  try {
    if (!Array.isArray(data)) {
      throw new PersonasFileValidationError('personas file must be a JSON array')
    }
    const personas = data.map((value, index) => parsePersonaEntry(value, index))
    return { ok: true, personas }
  } catch (error) {
    if (error instanceof PersonasFileValidationError) return { ok: false, error: error.message }
    return { ok: false, error: `Could not parse personas file: ${(error as Error).message}` }
  }
}
