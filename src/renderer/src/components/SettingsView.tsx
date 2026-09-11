import { useEffect, useState, type ReactElement } from 'react'
import type { LlmGenerateResult, LlmProvider, Settings, TraineeIdentity } from '../../../shared/data-types'
import PersonasSettings from './PersonasSettings'

const PROVIDERS: { id: LlmProvider; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'xai', label: 'Grok (xAI)' }
]

const EMPTY_API_KEYS: Record<LlmProvider, string> = {
  openai: '',
  anthropic: '',
  gemini: '',
  xai: ''
}

interface SettingsViewProps {
  onClose?: () => void
}

function SettingsView({ onClose }: SettingsViewProps): ReactElement {
  const [provider, setProvider] = useState<LlmProvider>('openai')
  const [model, setModel] = useState('')
  const [apiKeys, setApiKeys] = useState<Record<LlmProvider, string>>(EMPTY_API_KEYS)
  const [providerJustSaved, setProviderJustSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmGenerateResult | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [identityJustSaved, setIdentityJustSaved] = useState(false)

  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptJustSaved, setSystemPromptJustSaved] = useState(false)

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.api.data.settings.get(),
      window.api.data.identity.get(),
      window.api.data.systemPrompt.get()
    ]).then(([settings, identity, systemPromptConfig]) => {
      if (cancelled) return
      setProvider(settings.provider)
      setModel(settings.model)
      setApiKeys(settings.apiKeys)
      setDisplayName(identity.displayName)
      setJobTitle(identity.jobTitle)
      setFromEmail(identity.fromEmail)
      setSystemPrompt(systemPromptConfig.systemPrompt)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveProvider(): Promise<void> {
    const settings: Settings = { provider, model, apiKeys }
    await window.api.data.settings.set(settings)
    setProviderJustSaved(true)
  }

  async function handleTestConnection(): Promise<void> {
    setTesting(true)
    setTestResult(null)
    const result = await window.api.llm.test({ provider, model, apiKeys })
    setTestResult(result)
    setTesting(false)
  }

  async function handleSaveIdentity(): Promise<void> {
    const identity: TraineeIdentity = { displayName, jobTitle, fromEmail }
    await window.api.data.identity.set(identity)
    setIdentityJustSaved(true)
  }

  async function handleSaveSystemPrompt(): Promise<void> {
    await window.api.data.systemPrompt.set({ systemPrompt })
    setSystemPromptJustSaved(true)
  }

  const header = (
    <div className="settings-view-header">
      <h1 className="settings-view-title">Settings</h1>
      <button type="button" className="settings-view-close" aria-label="Close settings" onClick={onClose}>
        ✕
      </button>
    </div>
  )

  if (!loaded) {
    return (
      <div className="settings-view">
        {header}
      </div>
    )
  }

  return (
    <div className="settings-view">
      {header}
      <div className="settings-view-scroll">
        <section className="settings-section" aria-label="LLM Provider">
          <h2 className="settings-section-header">LLM Provider</h2>
          <div className="settings-section-body">
            <div className="settings-field-row">
              <label htmlFor="settings-provider">Provider</label>
              <select
                id="settings-provider"
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value as LlmProvider)
                  setProviderJustSaved(false)
                  setTestResult(null)
                }}
              >
                {PROVIDERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field-row">
              <label htmlFor="settings-model">Model</label>
              <input
                id="settings-model"
                type="text"
                placeholder="e.g. gpt-4o"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value)
                  setProviderJustSaved(false)
                  setTestResult(null)
                }}
              />
            </div>
            <div className="settings-field-row">
              <label htmlFor="settings-api-key">API Key</label>
              <input
                id="settings-api-key"
                type="password"
                autoComplete="off"
                placeholder={`${PROVIDERS.find((option) => option.id === provider)?.label} API key`}
                value={apiKeys[provider]}
                onChange={(event) => {
                  setApiKeys((prev) => ({ ...prev, [provider]: event.target.value }))
                  setProviderJustSaved(false)
                  setTestResult(null)
                }}
              />
            </div>
            <p className="settings-view-note">
              Stored locally in plaintext and used only for calls to the selected provider&apos;s own API.
            </p>
            <div className="settings-view-actions">
              <button type="button" onClick={handleSaveProvider}>
                Save
              </button>
              {providerJustSaved && <span className="settings-view-saved">Saved</span>}
              <button type="button" onClick={handleTestConnection} disabled={testing}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
            {testResult && (
              <p
                className={testResult.ok ? 'settings-test-result-ok' : 'settings-test-result-error'}
                role="status"
              >
                {testResult.ok ? `Success: ${testResult.text}` : testResult.error}
              </p>
            )}
          </div>
        </section>

        <section className="settings-section" aria-label="Trainee Identity">
          <h2 className="settings-section-header">Trainee Identity</h2>
          <div className="settings-section-body">
            <div className="settings-field-row">
              <label htmlFor="settings-display-name">Display Name</label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setIdentityJustSaved(false)
                }}
              />
            </div>
            <div className="settings-field-row">
              <label htmlFor="settings-job-title">Job Title</label>
              <input
                id="settings-job-title"
                type="text"
                value={jobTitle}
                onChange={(event) => {
                  setJobTitle(event.target.value)
                  setIdentityJustSaved(false)
                }}
              />
            </div>
            <div className="settings-field-row">
              <label htmlFor="settings-from-email">From Email</label>
              <input
                id="settings-from-email"
                type="email"
                value={fromEmail}
                onChange={(event) => {
                  setFromEmail(event.target.value)
                  setIdentityJustSaved(false)
                }}
              />
            </div>
            <p className="settings-view-note">Used as the From name/email on mail you send.</p>
            <div className="settings-view-actions">
              <button type="button" onClick={handleSaveIdentity}>
                Save
              </button>
              {identityJustSaved && <span className="settings-view-saved">Saved</span>}
            </div>
          </div>
        </section>

        <section className="settings-section" aria-label="System Prompt">
          <h2 className="settings-section-header">System Prompt</h2>
          <div className="settings-section-body">
            <textarea
              className="settings-system-prompt"
              aria-label="System Prompt"
              placeholder="Domain, goals, tone, and rules for this simulation…"
              value={systemPrompt}
              onChange={(event) => {
                setSystemPrompt(event.target.value)
                setSystemPromptJustSaved(false)
              }}
            />
            <div className="settings-view-actions">
              <button type="button" onClick={handleSaveSystemPrompt}>
                Save
              </button>
              {systemPromptJustSaved && <span className="settings-view-saved">Saved</span>}
            </div>
          </div>
        </section>

        <PersonasSettings />
      </div>
    </div>
  )
}

export default SettingsView
