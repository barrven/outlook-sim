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
  onFreePlayStarted?: () => void
  onScenarioPackLoaded?: () => void
}

function SettingsView({ onClose, onFreePlayStarted, onScenarioPackLoaded }: SettingsViewProps): ReactElement {
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

  const [freePlayStatus, setFreePlayStatus] = useState<string | null>(null)

  const [scenarioStatus, setScenarioStatus] = useState<string | null>(null)
  const [scenarioError, setScenarioError] = useState<string | null>(null)

  const [savePackStatus, setSavePackStatus] = useState<string | null>(null)
  const [savePackError, setSavePackError] = useState<string | null>(null)

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

  async function handleStartFreePlay(): Promise<void> {
    setFreePlayStatus(null)
    const result = await window.api.session.startFreePlay()
    if (!result.ok && result.needsConfirmation) {
      const confirmed = window.confirm(
        'Starting free-play will permanently delete the current mailbox and calendar. Continue?'
      )
      if (!confirmed) return
      await window.api.session.startFreePlay(true)
    }
    onFreePlayStarted?.()
    setFreePlayStatus('Free-play started — mailbox and calendar are now fresh and empty.')
  }

  async function handleLoadScenarioPack(): Promise<void> {
    setScenarioStatus(null)
    setScenarioError(null)
    const picked = await window.api.scenario.pickPack()
    if (!picked.ok) {
      if ('error' in picked) setScenarioError(picked.error)
      return
    }
    const result = await window.api.scenario.applyPack(picked.pack)
    if (!result.ok && result.needsConfirmation) {
      const confirmed = window.confirm(
        `Loading "${picked.pack.name}" will replace the current mailbox, calendar, and personas. Continue?`
      )
      if (!confirmed) return
      await window.api.scenario.applyPack(picked.pack, true)
    }
    onScenarioPackLoaded?.()
    setScenarioStatus(`Scenario pack "${picked.pack.name}" loaded.`)
  }

  async function handleSaveScenarioPack(): Promise<void> {
    setSavePackStatus(null)
    setSavePackError(null)
    const result = await window.api.scenario.savePack()
    if (!result.ok) {
      if ('error' in result) setSavePackError(result.error)
      return
    }
    setSavePackStatus(`Scenario pack saved to ${result.filePath}.`)
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
              <div
                className={testResult.ok ? 'settings-test-result-ok' : 'settings-test-result-error'}
                role={testResult.ok ? 'status' : 'alert'}
              >
                <span>{testResult.ok ? `Success: ${testResult.text}` : testResult.error}</span>
                {!testResult.ok && (
                  <>
                    <button type="button" onClick={handleTestConnection} disabled={testing}>
                      {testing ? 'Retrying…' : 'Retry'}
                    </button>
                    <button type="button" aria-label="Dismiss test result" onClick={() => setTestResult(null)}>
                      &times;
                    </button>
                  </>
                )}
              </div>
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

        <section className="settings-section" aria-label="Session">
          <h2 className="settings-section-header">Session</h2>
          <div className="settings-section-body">
            <p className="settings-view-note">
              Starts a free-play session: the mailbox and calendar reset to a fresh empty state, and the LLM
              features drive activity from there using the system prompt, personas, and identity above. No
              scenario pack is required.
            </p>
            <div className="settings-view-actions">
              <button type="button" onClick={handleStartFreePlay}>
                Start Free-Play
              </button>
              {freePlayStatus && <span className="settings-view-saved">{freePlayStatus}</span>}
            </div>
          </div>
        </section>

        <section className="settings-section" aria-label="Scenario Pack">
          <h2 className="settings-section-header">Scenario Pack</h2>
          <div className="settings-section-body">
            <p className="settings-view-note">
              Load a JSON scenario pack to seed the mailbox, calendar, and personas — replacing
              the current active state. Optional timed messages in the pack arrive later, once
              simulated time reaches them.
            </p>
            <div className="settings-view-actions">
              <button type="button" onClick={handleLoadScenarioPack}>
                Load Scenario Pack…
              </button>
              {scenarioStatus && <span className="settings-view-saved">{scenarioStatus}</span>}
            </div>
            {scenarioError && (
              <p className="settings-test-result-error" role="alert">
                {scenarioError}
              </p>
            )}
            <p className="settings-view-note">
              Save the current mailbox, calendar, and personas out to a JSON scenario pack file for
              reuse or sharing. API keys and other Settings are never included.
            </p>
            <div className="settings-view-actions">
              <button type="button" onClick={handleSaveScenarioPack}>
                Save Scenario Pack…
              </button>
              {savePackStatus && <span className="settings-view-saved">{savePackStatus}</span>}
            </div>
            {savePackError && (
              <p className="settings-test-result-error" role="alert">
                {savePackError}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default SettingsView
