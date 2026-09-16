import { describe, expect, it } from 'vitest'
import { validatePersonasFile } from './personasFile'

const VALID_PERSONA = {
  displayName: 'Morgan Rivera',
  email: 'morgan@example.com',
  role: 'Claims Adjuster',
  bio: 'Handles claims for AllState.',
  writingStyleNotes: 'Formal, brief.',
  extraPrompt: '',
  isClient: true,
  reportsTo: 'Patricia Sim'
}

describe('validatePersonasFile', () => {
  it('031 AC2: accepts a fully-populated, well-formed personas file', () => {
    const result = validatePersonasFile([VALID_PERSONA])
    expect(result).toEqual({ ok: true, personas: [VALID_PERSONA] })
  })

  it('031 AC2: accepts multiple entries', () => {
    const secondPersona = { ...VALID_PERSONA, displayName: 'Alex Chen', email: 'alex@example.com', isClient: false }
    const result = validatePersonasFile([VALID_PERSONA, secondPersona])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.personas).toHaveLength(2)
  })

  it('031 AC2: an empty array is a valid (empty) personas list', () => {
    const result = validatePersonasFile([])
    expect(result).toEqual({ ok: true, personas: [] })
  })

  it('031 AC2: defaults optional fields (role/bio/writingStyleNotes/extraPrompt/isClient/reportsTo) when omitted', () => {
    const result = validatePersonasFile([{ displayName: 'Alex', email: 'alex@example.com' }])
    expect(result).toEqual({
      ok: true,
      personas: [
        {
          displayName: 'Alex',
          email: 'alex@example.com',
          role: '',
          bio: '',
          writingStyleNotes: '',
          extraPrompt: '',
          isClient: false,
          reportsTo: ''
        }
      ]
    })
  })

  it.each([
    [null, 'personas file must be a JSON array'],
    ['just a string', 'personas file must be a JSON array'],
    [42, 'personas file must be a JSON array'],
    [{ personas: [] }, 'personas file must be a JSON array'],
    [[null], 'personas[0] must be an object'],
    [['just a string'], 'personas[0] must be an object'],
    [[[]], 'personas[0] must be an object'],
    [[{ email: 'a@x.com' }], 'personas[0].displayName must be a string'],
    [[{ displayName: 'No Email' }], 'personas[0].email must be a string'],
    [[{ displayName: 'A', email: 'a@x.com', role: 42 }], 'personas[0].role must be a string'],
    [[{ displayName: 'A', email: 'a@x.com', isClient: 'yes' }], 'personas[0].isClient must be a boolean'],
    [[{ displayName: 'A', email: 'a@x.com', reportsTo: 42 }], 'personas[0].reportsTo must be a string']
  ])('031 AC3: rejects %p with a clear, specific error, not a crash', (input, expectedError) => {
    expect(() => validatePersonasFile(input)).not.toThrow()
    const result = validatePersonasFile(input)
    expect(result).toEqual({ ok: false, error: expectedError })
  })

  it('031 AC3: identifies which entry in a multi-entry file is invalid, by index', () => {
    const result = validatePersonasFile([VALID_PERSONA, { email: 'missing-name@example.com' }])
    expect(result).toEqual({ ok: false, error: 'personas[1].displayName must be a string' })
  })
})
