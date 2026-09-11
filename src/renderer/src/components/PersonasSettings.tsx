import { useEffect, useState, type ReactElement } from 'react'
import type { Persona } from '../../../shared/data-types'

interface PersonaForm {
  displayName: string
  email: string
  role: string
  bio: string
  writingStyleNotes: string
  extraPrompt: string
}

const EMPTY_FORM: PersonaForm = {
  displayName: '',
  email: '',
  role: '',
  bio: '',
  writingStyleNotes: '',
  extraPrompt: ''
}

function generatePersonaId(): string {
  return `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function PersonasSettings(): ReactElement {
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
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      extraPrompt: persona.extraPrompt
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
