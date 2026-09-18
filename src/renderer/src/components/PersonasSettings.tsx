import { Fragment, useEffect, useState, type ReactElement } from 'react'
import type { Persona, PersonasFilePersona } from '../../../shared/data-types'

interface PersonaForm {
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
  isClient: boolean
  reportsTo: string
}

const EMPTY_FORM: PersonaForm = {
  displayName: '',
  email: '',
  role: '',
  bio: '',
  writingStyleNotes: '',
  extraPrompt: '',
  isClient: false,
  reportsTo: ''
}

function generatePersonaId(): string {
  return `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface PersonasSettingsProps {
  // Bumped by the parent after a scenario pack load (feature 030) to
  // trigger a refetch — undefined/unchanging means "just the initial
  // mount fetch," so existing callers with no prop at all still work.
  reloadKey?: number
}

function PersonasSettings({ reloadKey }: PersonasSettingsProps): ReactElement {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<PersonaForm>(EMPTY_FORM)
  const [loadPersonasError, setLoadPersonasError] = useState<string | null>(null)
  const [generateDescription, setGenerateDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatedPersonas, setGeneratedPersonas] = useState<PersonasFilePersona[] | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.data.personas.get().then((list) => {
      if (cancelled) return
      setPersonas(list)
      setLoaded(true)
      // A scenario pack load (the only thing that bumps `reloadKey`) can
      // invalidate an in-progress unsaved create/edit form — the persona
      // being edited may no longer exist, or the "new persona" form no
      // longer matches what's about to be shown. Discard it rather than
      // leave it dangling; the user already confirmed a destructive
      // replace to get here (AC4). A no-op on the initial mount, since
      // nothing is open yet. An in-progress generated-personas review is
      // discarded the same way.
      setCreating(false)
      setEditingId(null)
      setGeneratedPersonas(null)
      setGenerateError(null)
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function openCreate(): void {
    setForm(EMPTY_FORM)
    setCreating(true)
    setEditingId(null)
  }

  function openEdit(persona: Persona): void {
    setForm({
      displayName: persona.displayName,
      email: persona.email,
      role: persona.role,
      bio: persona.bio,
      writingStyleNotes: persona.writingStyleNotes,
      extraPrompt: persona.extraPrompt,
      isClient: persona.isClient,
      // Data saved before feature 028 lacks this field (AC4: load without error, default to empty).
      reportsTo: persona.reportsTo ?? ''
    })
    setEditingId(persona.id)
    setCreating(false)
  }

  function closeEditor(): void {
    setCreating(false)
    setEditingId(null)
  }

  async function handleSubmit(): Promise<void> {
    const updated = editingId
      ? personas.map((persona) => (persona.id === editingId ? { ...persona, ...form } : persona))
      : [...personas, { id: generatePersonaId(), ...form }]
    await window.api.data.personas.set(updated)
    setPersonas(updated)
    closeEditor()
  }

  async function handleDelete(id: string): Promise<void> {
    const updated = personas.filter((persona) => persona.id !== id)
    await window.api.data.personas.set(updated)
    setPersonas(updated)
    if (editingId === id) closeEditor()
  }

  // Imports a standalone personas-only JSON file (feature 031), replacing
  // the current list — distinct from a scenario pack load, which never
  // touches mailbox/calendar/system prompt here since it only ever calls
  // the existing `personas.set` (the same call the manual create/edit
  // form already uses), nothing scenario-pack-specific.
  async function handleLoadPersonas(): Promise<void> {
    setLoadPersonasError(null)
    const result = await window.api.personasFile.pick()
    if (!result.ok) {
      if ('error' in result) setLoadPersonasError(result.error)
      return
    }
    const imported: Persona[] = result.personas.map((persona) => ({ id: generatePersonaId(), ...persona }))
    await window.api.data.personas.set(imported)
    setPersonas(imported)
    closeEditor()
  }

  // Asks the LLM to generate a persona cast from a free-text company/
  // industry description (feature 032), staging the result for review
  // rather than committing it directly (AC2/AC3) — unlike Load Personas,
  // which replaces the list, a successful generation is only ever added
  // to it once the user explicitly accepts.
  async function handleGeneratePersonas(): Promise<void> {
    if (!generateDescription.trim()) return
    setGenerating(true)
    setGenerateError(null)
    setGeneratedPersonas(null)
    const result = await window.api.llm.generatePersonas(generateDescription.trim())
    setGenerating(false)
    if (!result.ok) {
      setGenerateError(result.error)
      return
    }
    setGeneratedPersonas(result.personas)
  }

  async function handleAcceptGenerated(): Promise<void> {
    if (!generatedPersonas) return
    const added: Persona[] = generatedPersonas.map((persona) => ({ id: generatePersonaId(), ...persona }))
    const updated = [...personas, ...added]
    await window.api.data.personas.set(updated)
    setPersonas(updated)
    setGeneratedPersonas(null)
    setGenerateDescription('')
  }

  function handleDiscardGenerated(): void {
    setGeneratedPersonas(null)
  }

  const isEditorOpen = creating || editingId !== null

  // Shared between the two placements the editor can appear in — inline
  // under the persona being edited (feature 050), or below the whole list
  // when creating (AC3, unaffected by this feature). A plain JSX value
  // rather than a nested component function, so its `<form>`/inputs keep
  // their normal DOM identity wherever it's rendered.
  const editorForm = (
    <form
      className="persona-editor"
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      <div className="settings-field-row">
        <label htmlFor="persona-display-name">Display Name</label>
        <input
          id="persona-display-name"
          type="text"
          value={form.displayName}
          onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-email">Email</label>
        <input
          id="persona-email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-role">Role</label>
        <input
          id="persona-role"
          type="text"
          value={form.role}
          onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-reports-to">Reports To</label>
        <input
          id="persona-reports-to"
          type="text"
          placeholder="Optional — may be outside the configured cast"
          value={form.reportsTo}
          onChange={(event) => setForm((prev) => ({ ...prev, reportsTo: event.target.value }))}
        />
      </div>
      <div className="settings-field-row settings-field-row-checkbox">
        <label htmlFor="persona-is-client">Client</label>
        <input
          id="persona-is-client"
          type="checkbox"
          checked={form.isClient}
          onChange={(event) => setForm((prev) => ({ ...prev, isClient: event.target.checked }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-bio">Bio</label>
        <textarea
          id="persona-bio"
          className="persona-textarea"
          value={form.bio}
          onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-writing-style">Writing Style</label>
        <textarea
          id="persona-writing-style"
          className="persona-textarea"
          value={form.writingStyleNotes}
          onChange={(event) => setForm((prev) => ({ ...prev, writingStyleNotes: event.target.value }))}
        />
      </div>
      <div className="settings-field-row">
        <label htmlFor="persona-extra-prompt">Extra Prompt</label>
        <textarea
          id="persona-extra-prompt"
          className="persona-textarea"
          placeholder="Optional"
          value={form.extraPrompt}
          onChange={(event) => setForm((prev) => ({ ...prev, extraPrompt: event.target.value }))}
        />
      </div>
      <div className="settings-view-actions">
        <button type="submit" disabled={!form.displayName.trim() || !form.email.trim()}>
          {editingId ? 'Save' : 'Add Persona'}
        </button>
        <button type="button" onClick={closeEditor}>
          Cancel
        </button>
      </div>
    </form>
  )

  return (
    <section className="settings-section" aria-label="Personas">
      <h2 className="settings-section-header">Personas</h2>
      <div className="settings-section-body">
        {loaded && (
          <>
            {personas.length > 0 ? (
              <ul className="persona-list">
                {personas.map((persona) => (
                  <Fragment key={persona.id}>
                    <li className="persona-list-item">
                      <div className="persona-list-item-info">
                        <span className="persona-list-item-name">{persona.displayName || '(unnamed)'}</span>
                        <span className="persona-list-item-meta">
                          {persona.email}
                          {persona.role ? ` · ${persona.role}` : ''}
                          {persona.isClient ? ' · Client' : ''}
                        </span>
                      </div>
                      <span className="persona-list-item-actions">
                        <button type="button" onClick={() => openEdit(persona)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(persona.id)}
                          aria-label={`Delete ${persona.displayName || persona.email}`}
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                    {editingId === persona.id && <li className="persona-editor-row">{editorForm}</li>}
                  </Fragment>
                ))}
              </ul>
            ) : (
              !isEditorOpen && <p className="settings-view-note">No personas yet.</p>
            )}

            {creating ? (
              editorForm
            ) : editingId !== null ? null : generatedPersonas ? (
              <div className="persona-generate-review">
                <p className="settings-view-note">
                  Generated {generatedPersonas.length} persona{generatedPersonas.length === 1 ? '' : 's'} — review
                  before adding:
                </p>
                <ul className="persona-list">
                  {generatedPersonas.map((persona, index) => (
                    <li key={index} className="persona-list-item">
                      <div className="persona-list-item-info">
                        <span className="persona-list-item-name">{persona.displayName || '(unnamed)'}</span>
                        <span className="persona-list-item-meta">
                          {persona.email}
                          {persona.role ? ` · ${persona.role}` : ''}
                          {persona.isClient ? ' · Client' : ''}
                          {persona.reportsTo ? ` · Reports to ${persona.reportsTo}` : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="settings-view-actions">
                  <button type="button" onClick={handleAcceptGenerated}>
                    Add {generatedPersonas.length} Persona{generatedPersonas.length === 1 ? '' : 's'}
                  </button>
                  <button type="button" onClick={handleDiscardGenerated}>
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="settings-view-actions">
                <button type="button" className="folder-new-btn" onClick={openCreate}>
                  + New Persona
                </button>
                <button type="button" onClick={handleLoadPersonas}>
                  Load Personas…
                </button>
              </div>
            )}
            {loadPersonasError && (
              <p className="settings-test-result-error" role="alert">
                {loadPersonasError}
              </p>
            )}

            {!isEditorOpen && !generatedPersonas && (
              <div className="persona-generate">
                <label htmlFor="persona-generate-description">Generate Personas</label>
                <textarea
                  id="persona-generate-description"
                  className="persona-textarea"
                  placeholder="Describe the company or industry, e.g. 'a mid-size personal injury law firm in Chicago'"
                  value={generateDescription}
                  onChange={(event) => setGenerateDescription(event.target.value)}
                />
                <div className="settings-view-actions">
                  <button
                    type="button"
                    onClick={handleGeneratePersonas}
                    disabled={generating || !generateDescription.trim()}
                  >
                    {generating ? 'Generating…' : 'Generate Personas'}
                  </button>
                </div>
                {generateError && (
                  <p className="settings-test-result-error" role="alert">
                    {generateError}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default PersonasSettings
