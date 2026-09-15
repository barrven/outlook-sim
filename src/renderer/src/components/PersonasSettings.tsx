import { useEffect, useState, type ReactElement } from 'react'
import type { Persona } from '../../../shared/data-types'

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
      // nothing is open yet.
      setCreating(false)
      setEditingId(null)
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

  const isEditorOpen = creating || editingId !== null

  return (
    <section className="settings-section" aria-label="Personas">
      <h2 className="settings-section-header">Personas</h2>
      <div className="settings-section-body">
        {loaded && (
          <>
            {personas.length > 0 ? (
              <ul className="persona-list">
                {personas.map((persona) => (
                  <li key={persona.id} className="persona-list-item">
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
                ))}
              </ul>
            ) : (
              !isEditorOpen && <p className="settings-view-note">No personas yet.</p>
            )}

            {isEditorOpen ? (
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
                <div className="settings-field-row">
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
            ) : (
              <button type="button" className="folder-new-btn" onClick={openCreate}>
                + New Persona
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default PersonasSettings
