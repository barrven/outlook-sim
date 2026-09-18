// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsView from './SettingsView'
import type { ScenarioPack, Settings, SystemPromptConfig, TraineeIdentity } from '../../../shared/data-types'

const SETTINGS: Settings = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKeys: { openai: 'sk-openai', anthropic: 'sk-anthropic', gemini: '', xai: '' }
}

const IDENTITY: TraineeIdentity = {
  displayName: 'Jordan Trainee',
  jobTitle: 'Analyst',
  fromEmail: 'jordan.trainee@example.com',
  reportsTo: 'Patricia Sim',
  department: 'Litigation'
}

const SYSTEM_PROMPT: SystemPromptConfig = {
  systemPrompt: 'Domain: insurance office. Be terse and professional.'
}

const SCENARIO_PACK: ScenarioPack = {
  name: 'Grillo Law Intake',
  description: '',
  personas: [
    {
      displayName: 'Morgan Rivera',
      email: 'morgan@example.com',
      role: 'Claims Adjuster',
      bio: '',
      writingStyleNotes: '',
      extraPrompt: ''
    }
  ],
  inbox: [],
  calendarItems: [],
  timedMessages: [],
  systemPrompt: 'Domain: insurance claims intake. Be terse and professional.'
}

function providerSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'LLM Provider' }))
}

function identitySection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Trainee Identity' }))
}

function systemPromptSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'System Prompt' }))
}

function appearanceSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Appearance' }))
}

function sessionSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Session' }))
}

function scenarioPackSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Scenario Pack' }))
}

function personasSection(): ReturnType<typeof within> {
  return within(screen.getByRole('region', { name: 'Personas' }))
}

describe('SettingsView', () => {
  it('lists OpenAI, Anthropic, Gemini, and Grok (xAI) as selectable providers', async () => {
    render(<SettingsView />)

    const select = await screen.findByLabelText('Provider')
    const options = within(select).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['OpenAI', 'Anthropic', 'Gemini', 'Grok (xAI)'])
  })

  it('prefills provider, model, and that provider’s API key from saved settings', async () => {
    vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

    render(<SettingsView />)

    expect(await screen.findByLabelText('Provider')).toHaveValue('openai')
    expect(screen.getByLabelText('Model')).toHaveValue('gpt-4o')
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-openai')
  })

  it('lets the user type a model name', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

    render(<SettingsView />)

    const modelInput = await screen.findByLabelText('Model')
    await user.clear(modelInput)
    await user.type(modelInput, 'gpt-4o-mini')

    expect(modelInput).toHaveValue('gpt-4o-mini')
  })

  it('switching provider shows that provider’s own key, and preserves in-progress edits across switches', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

    render(<SettingsView />)

    const providerSelect = await screen.findByLabelText('Provider')
    const apiKeyInput = screen.getByLabelText('API Key')
    expect(apiKeyInput).toHaveValue('sk-openai')

    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'sk-openai-edited')

    await user.selectOptions(providerSelect, 'anthropic')
    expect(apiKeyInput).toHaveValue('sk-anthropic')

    await user.selectOptions(providerSelect, 'gemini')
    expect(apiKeyInput).toHaveValue('')

    await user.selectOptions(providerSelect, 'openai')
    expect(apiKeyInput).toHaveValue('sk-openai-edited')
  })

  it('saves provider, model, and the full apiKeys record (including edits to a non-selected provider) on Save', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

    render(<SettingsView />)

    const providerSelect = await screen.findByLabelText('Provider')
    await user.selectOptions(providerSelect, 'anthropic')
    const apiKeyInput = screen.getByLabelText('API Key')
    await user.clear(apiKeyInput)
    await user.type(apiKeyInput, 'sk-anthropic-new')

    await user.click(providerSection().getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(window.api.data.settings.set).toHaveBeenCalled())
    expect(window.api.data.settings.set).toHaveBeenCalledWith({
      provider: 'anthropic',
      model: 'gpt-4o',
      apiKeys: { openai: 'sk-openai', anthropic: 'sk-anthropic-new', gemini: '', xai: '' }
    })
  })

  it('shows a Saved indicator after Save, and clears it on further edits', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

    render(<SettingsView />)

    await screen.findByLabelText('Provider')
    expect(providerSection().queryByText('Saved')).not.toBeInTheDocument()

    await user.click(providerSection().getByRole('button', { name: 'Save' }))
    expect(await providerSection().findByText('Saved')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Model'), 'x')
    expect(providerSection().queryByText('Saved')).not.toBeInTheDocument()
  })

  it('masks the API key input', async () => {
    render(<SettingsView />)

    const apiKeyInput = await screen.findByLabelText('API Key')
    expect(apiKeyInput).toHaveAttribute('type', 'password')
  })

  describe('Test Connection', () => {
    it('makes no LLM call merely by mounting or loading Settings — only the button click triggers one', async () => {
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)

      render(<SettingsView />)
      await screen.findByLabelText('Provider')

      expect(window.api.llm.generate).not.toHaveBeenCalled()
      expect(window.api.llm.test).not.toHaveBeenCalled()
    })

    it('calls llm.test with the currently displayed (possibly unsaved) provider/model/key', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: true, text: 'pong' })

      render(<SettingsView />)

      const modelInput = await screen.findByLabelText('Model')
      await user.clear(modelInput)
      await user.type(modelInput, 'gpt-4o-mini')

      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))

      await waitFor(() => expect(window.api.llm.test).toHaveBeenCalled())
      expect(window.api.llm.test).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKeys: SETTINGS.apiKeys
      })
    })

    it('shows the returned text on success', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: true, text: 'pong' })

      render(<SettingsView />)

      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))

      expect(await providerSection().findByText('Success: pong')).toBeInTheDocument()
    })

    it('shows the error message on failure, without crashing', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({
        ok: false,
        error: 'openai API error (401): Incorrect API key provided.'
      })

      render(<SettingsView />)

      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))

      expect(
        await providerSection().findByText('openai API error (401): Incorrect API key provided.')
      ).toBeInTheDocument()
    })

    it('027 AC1: shows Retry and Dismiss on failure, but neither on success', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: false, error: 'bad key' })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))
      await providerSection().findByText('bad key')

      expect(providerSection().getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(providerSection().getByRole('button', { name: 'Dismiss test result' })).toBeInTheDocument()

      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: true, text: 'pong' })
      await user.click(providerSection().getByRole('button', { name: 'Retry' }))
      await providerSection().findByText('Success: pong')

      expect(providerSection().queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
      expect(providerSection().queryByRole('button', { name: 'Dismiss test result' })).not.toBeInTheDocument()
    })

    it('027 AC2: Retry re-calls llm.test with the currently displayed settings, same as the original call', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: false, error: 'bad key' })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))
      await providerSection().findByText('bad key')

      await user.click(providerSection().getByRole('button', { name: 'Retry' }))

      expect(window.api.llm.test).toHaveBeenCalledTimes(2)
      expect(window.api.llm.test).toHaveBeenNthCalledWith(2, {
        provider: 'openai',
        model: 'gpt-4o',
        apiKeys: SETTINGS.apiKeys
      })
    })

    it('027 AC2: a second failure on Retry updates the same error message rather than adding another', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: false, error: 'first error' })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))
      await providerSection().findByText('first error')

      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: false, error: 'second error' })
      await user.click(providerSection().getByRole('button', { name: 'Retry' }))

      expect(await providerSection().findByText('second error')).toBeInTheDocument()
      expect(providerSection().queryByText('first error')).not.toBeInTheDocument()
    })

    it('027 AC1: Dismiss clears the error without changing any field', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: false, error: 'bad key' })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))
      await providerSection().findByText('bad key')

      await user.click(providerSection().getByRole('button', { name: 'Dismiss test result' }))

      expect(providerSection().queryByText('bad key')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Model')).toHaveValue('gpt-4o')
    })

    it('clears a stale test result when the provider, model, or key changes', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.settings.get).mockResolvedValue(SETTINGS)
      vi.mocked(window.api.llm.test).mockResolvedValue({ ok: true, text: 'pong' })

      render(<SettingsView />)

      await screen.findByLabelText('Provider')
      await user.click(providerSection().getByRole('button', { name: 'Test Connection' }))
      expect(await providerSection().findByText('Success: pong')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Model'), 'x')
      expect(providerSection().queryByText('Success: pong')).not.toBeInTheDocument()
    })
  })

  describe('Trainee Identity', () => {
    it('prefills display name, job title, and from email from saved identity', async () => {
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      expect(await screen.findByLabelText('Display Name')).toHaveValue('Jordan Trainee')
      expect(screen.getByLabelText('Job Title')).toHaveValue('Analyst')
      expect(screen.getByLabelText('From Email')).toHaveValue('jordan.trainee@example.com')
    })

    it('028 AC1: prefills Reports To and Department from saved identity', async () => {
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      expect(await screen.findByLabelText('Reports To')).toHaveValue('Patricia Sim')
      expect(screen.getByLabelText('Department')).toHaveValue('Litigation')
    })

    it('028 AC1/AC3: lets the user edit and save Reports To and Department, alongside the existing identity fields', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      const reportsToInput = await screen.findByLabelText('Reports To')
      await user.clear(reportsToInput)
      await user.type(reportsToInput, 'Salvatore Grillo')

      const departmentInput = screen.getByLabelText('Department')
      await user.clear(departmentInput)
      await user.type(departmentInput, 'Accident Benefits')

      await user.click(identitySection().getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(window.api.data.identity.set).toHaveBeenCalled())
      expect(window.api.data.identity.set).toHaveBeenCalledWith({
        displayName: 'Jordan Trainee',
        jobTitle: 'Analyst',
        fromEmail: 'jordan.trainee@example.com',
        reportsTo: 'Salvatore Grillo',
        department: 'Accident Benefits'
      })
    })

    it('028 AC3: Reports To and Department are optional — blank is valid and saves as empty', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.identity.get).mockResolvedValue({
        displayName: 'Jordan Trainee',
        jobTitle: 'Analyst',
        fromEmail: 'jordan.trainee@example.com',
        reportsTo: '',
        department: ''
      })

      render(<SettingsView />)
      await screen.findByLabelText('Display Name')
      await user.click(identitySection().getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(window.api.data.identity.set).toHaveBeenCalled())
      expect(window.api.data.identity.set).toHaveBeenCalledWith(
        expect.objectContaining({ reportsTo: '', department: '' })
      )
    })

    it('028 AC4: identity missing reportsTo/department (pre-feature data) loads without error, fields render blank', async () => {
      vi.mocked(window.api.data.identity.get).mockResolvedValue({
        displayName: 'Legacy Trainee',
        jobTitle: 'Analyst',
        fromEmail: 'legacy@example.com'
      } as TraineeIdentity)

      render(<SettingsView />)

      expect(await screen.findByLabelText('Reports To')).toHaveValue('')
      expect(screen.getByLabelText('Department')).toHaveValue('')
    })

    it('lets the user edit and save their identity', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      const displayNameInput = await screen.findByLabelText('Display Name')
      await user.clear(displayNameInput)
      await user.type(displayNameInput, 'Jordan T. Trainee')

      const jobTitleInput = screen.getByLabelText('Job Title')
      await user.clear(jobTitleInput)
      await user.type(jobTitleInput, 'Senior Analyst')

      const fromEmailInput = screen.getByLabelText('From Email')
      await user.clear(fromEmailInput)
      await user.type(fromEmailInput, 'jordan.t@example.com')

      await user.click(identitySection().getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(window.api.data.identity.set).toHaveBeenCalled())
      expect(window.api.data.identity.set).toHaveBeenCalledWith({
        displayName: 'Jordan T. Trainee',
        jobTitle: 'Senior Analyst',
        fromEmail: 'jordan.t@example.com',
        reportsTo: 'Patricia Sim',
        department: 'Litigation'
      })
    })

    it('shows its own Saved indicator independently of the other sections', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      await screen.findByLabelText('Display Name')
      await user.click(identitySection().getByRole('button', { name: 'Save' }))

      expect(await identitySection().findByText('Saved')).toBeInTheDocument()
      expect(providerSection().queryByText('Saved')).not.toBeInTheDocument()
      expect(systemPromptSection().queryByText('Saved')).not.toBeInTheDocument()
    })

    it('the From Email field is an email input', async () => {
      render(<SettingsView />)

      const fromEmailInput = await screen.findByLabelText('From Email')
      expect(fromEmailInput).toHaveAttribute('type', 'email')
    })
  })

  describe('System Prompt', () => {
    it('prefills the system prompt from saved config', async () => {
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValue(SYSTEM_PROMPT)

      render(<SettingsView />)

      const section = within(await screen.findByRole('region', { name: 'System Prompt' }))
      expect(section.getByRole('textbox')).toHaveValue(SYSTEM_PROMPT.systemPrompt)
    })

    it('lets the user edit and save the system prompt', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValue({ systemPrompt: '' })

      render(<SettingsView />)

      const section = within(await screen.findByRole('region', { name: 'System Prompt' }))
      const textarea = section.getByRole('textbox')
      await user.type(textarea, 'Domain: law firm. Formal tone.')

      await user.click(section.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(window.api.data.systemPrompt.set).toHaveBeenCalled())
      expect(window.api.data.systemPrompt.set).toHaveBeenCalledWith({
        systemPrompt: 'Domain: law firm. Formal tone.'
      })
    })

    it('shows its own Saved indicator independently of the other sections', async () => {
      const user = userEvent.setup()
      render(<SettingsView />)

      const section = within(await screen.findByRole('region', { name: 'System Prompt' }))
      await user.click(section.getByRole('button', { name: 'Save' }))

      expect(await section.findByText('Saved')).toBeInTheDocument()
      expect(providerSection().queryByText('Saved')).not.toBeInTheDocument()
      expect(identitySection().queryByText('Saved')).not.toBeInTheDocument()
    })
  })

  describe('Session', () => {
    it('starts free-play with no confirmation prompt when the mailbox/calendar is already empty', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.session.startFreePlay).mockResolvedValue({ ok: true })
      const confirmSpy = vi.spyOn(window, 'confirm')

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(sessionSection().getByRole('button', { name: 'Start Free-Play' }))

      await waitFor(() => expect(window.api.session.startFreePlay).toHaveBeenCalled())
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(window.api.session.startFreePlay).toHaveBeenCalledTimes(1)
      expect(await sessionSection().findByText(/fresh and empty/)).toBeInTheDocument()
    })

    it('asks for confirmation when starting free-play would discard existing data, and proceeds on confirm', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.session.startFreePlay)
        .mockResolvedValueOnce({ ok: false, needsConfirmation: true })
        .mockResolvedValueOnce({ ok: true })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(sessionSection().getByRole('button', { name: 'Start Free-Play' }))

      await waitFor(() => expect(window.api.session.startFreePlay).toHaveBeenCalledTimes(2))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(window.api.session.startFreePlay).toHaveBeenNthCalledWith(2, true)
      expect(await sessionSection().findByText(/fresh and empty/)).toBeInTheDocument()
    })

    it('does not reset when the user declines the confirmation', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.session.startFreePlay).mockResolvedValue({ ok: false, needsConfirmation: true })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(sessionSection().getByRole('button', { name: 'Start Free-Play' }))

      await waitFor(() => expect(window.api.session.startFreePlay).toHaveBeenCalledTimes(1))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(sessionSection().queryByText(/fresh and empty/)).not.toBeInTheDocument()
    })
  })

  describe('Scenario Pack', () => {
    it('loads a pack with no confirmation prompt when the mailbox/calendar is already empty', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack).mockResolvedValue({ ok: true })
      const confirmSpy = vi.spyOn(window, 'confirm')

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(1))
      expect(window.api.scenario.applyPack).toHaveBeenCalledWith(SCENARIO_PACK)
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(await scenarioPackSection().findByText(/Grillo Law Intake.*loaded/)).toBeInTheDocument()
    })

    it('does nothing (no error, no status) when the file dialog is canceled', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: false, canceled: true })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.pickPack).toHaveBeenCalled())
      expect(window.api.scenario.applyPack).not.toHaveBeenCalled()
      expect(scenarioPackSection().queryByRole('alert')).not.toBeInTheDocument()
      expect(scenarioPackSection().queryByText(/loaded/)).not.toBeInTheDocument()
    })

    it('shows a clear inline error, and does not attempt to apply, when the picked file is invalid', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({
        ok: false,
        error: 'personas[0].displayName must be a string'
      })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))

      expect(await scenarioPackSection().findByRole('alert')).toHaveTextContent(
        'personas[0].displayName must be a string'
      )
      expect(window.api.scenario.applyPack).not.toHaveBeenCalled()
    })

    it('asks for confirmation when loading would discard existing data, and proceeds on confirm', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack)
        .mockResolvedValueOnce({ ok: false, needsConfirmation: true })
        .mockResolvedValueOnce({ ok: true })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(2))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(window.api.scenario.applyPack).toHaveBeenNthCalledWith(2, SCENARIO_PACK, true)
      expect(await scenarioPackSection().findByText(/Grillo Law Intake.*loaded/)).toBeInTheDocument()
    })

    it('does not apply, and shows no success status, when the user declines the confirmation', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack).mockResolvedValue({ ok: false, needsConfirmation: true })
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(1))
      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(scenarioPackSection().queryByText(/loaded/)).not.toBeInTheDocument()
    })
  })

  describe('Settings panels refresh live after a scenario pack load (feature 030)', () => {
    it('030 AC1: updates the visible persona list without navigating away and back', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([])
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack).mockResolvedValue({ ok: true })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await personasSection().findByText('No personas yet.')

      vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([
        {
          id: 'p1',
          displayName: 'Morgan Rivera',
          email: 'morgan@example.com',
          role: 'Claims Adjuster',
          bio: '',
          writingStyleNotes: '',
          extraPrompt: '',
          isClient: false,
          reportsTo: ''
        }
      ])
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))
      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(1))

      expect(await personasSection().findByText('Morgan Rivera')).toBeInTheDocument()
      expect(personasSection().queryByText('No personas yet.')).not.toBeInTheDocument()
      // Still the same open Settings view — other sections are untouched, no navigation happened.
      expect(providerSection().getByLabelText('Provider')).toBeInTheDocument()
    })

    it('030 AC2: updates the visible System Prompt text the same way', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({ systemPrompt: 'Old prompt.' })
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack).mockResolvedValue({ ok: true })

      render(<SettingsView />)
      await screen.findByRole('region', { name: 'System Prompt' })
      const textarea = systemPromptSection().getByRole('textbox')
      expect(textarea).toHaveValue('Old prompt.')

      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({
        systemPrompt: SCENARIO_PACK.systemPrompt ?? ''
      })
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))
      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(1))

      await waitFor(() => expect(textarea).toHaveValue(SCENARIO_PACK.systemPrompt))
    })

    it('030 AC3: closing and reopening Settings fetches fresh data independently — nothing leaks from a previous session', async () => {
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({ systemPrompt: 'First session prompt' })
      vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([])

      const { unmount } = render(<SettingsView />)
      await screen.findByRole('region', { name: 'System Prompt' })
      expect(systemPromptSection().getByRole('textbox')).toHaveValue('First session prompt')
      unmount()

      // A scenario pack could have loaded while this instance didn't exist — closing
      // Settings unmounts it entirely, so there's nothing here to have missed it.
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({ systemPrompt: 'Second session prompt' })
      vi.mocked(window.api.data.personas.get).mockResolvedValueOnce([
        {
          id: 'p1',
          displayName: 'Reopened Persona',
          email: 'reopened@example.com',
          role: '',
          bio: '',
          writingStyleNotes: '',
          extraPrompt: '',
          isClient: false,
          reportsTo: ''
        }
      ])

      render(<SettingsView />)
      await screen.findByRole('region', { name: 'System Prompt' })
      expect(systemPromptSection().getByRole('textbox')).toHaveValue('Second session prompt')
      expect(await personasSection().findByText('Reopened Persona')).toBeInTheDocument()
    })

    it('030 AC4: an in-progress unsaved System Prompt edit is overwritten (not preserved) by a pack load', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({ systemPrompt: '' })
      vi.mocked(window.api.scenario.pickPack).mockResolvedValue({ ok: true, pack: SCENARIO_PACK })
      vi.mocked(window.api.scenario.applyPack).mockResolvedValue({ ok: true })

      render(<SettingsView />)
      await screen.findByRole('region', { name: 'System Prompt' })
      const textarea = systemPromptSection().getByRole('textbox')
      await user.type(textarea, 'unsaved draft, never saved')
      expect(textarea).toHaveValue('unsaved draft, never saved')

      vi.mocked(window.api.data.systemPrompt.get).mockResolvedValueOnce({
        systemPrompt: SCENARIO_PACK.systemPrompt ?? ''
      })
      await user.click(scenarioPackSection().getByRole('button', { name: 'Load Scenario Pack…' }))
      await waitFor(() => expect(window.api.scenario.applyPack).toHaveBeenCalledTimes(1))

      await waitFor(() => expect(textarea).toHaveValue(SCENARIO_PACK.systemPrompt))
      expect(window.api.data.systemPrompt.set).not.toHaveBeenCalled()
    })
  })

  describe('Save Scenario Pack', () => {
    it('saves and shows the destination path on success', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.savePack).mockResolvedValue({
        ok: true,
        filePath: '/home/trainee/my-pack.json'
      })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Save Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.savePack).toHaveBeenCalledTimes(1))
      expect(await scenarioPackSection().findByText(/my-pack\.json/)).toBeInTheDocument()
      expect(scenarioPackSection().queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does nothing (no error, no status) when the save dialog is canceled', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.savePack).mockResolvedValue({ ok: false, canceled: true })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Save Scenario Pack…' }))

      await waitFor(() => expect(window.api.scenario.savePack).toHaveBeenCalledTimes(1))
      expect(scenarioPackSection().queryByRole('alert')).not.toBeInTheDocument()
      expect(scenarioPackSection().queryByText(/saved/)).not.toBeInTheDocument()
    })

    it('shows a clear inline error when the write fails', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.savePack).mockResolvedValue({
        ok: false,
        error: 'Could not write file: EACCES'
      })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      await user.click(scenarioPackSection().getByRole('button', { name: 'Save Scenario Pack…' }))

      expect(await scenarioPackSection().findByRole('alert')).toHaveTextContent(
        'Could not write file: EACCES'
      )
      expect(scenarioPackSection().queryByText(/saved/)).not.toBeInTheDocument()
    })

    it('clears a previous error once a later save succeeds', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.scenario.savePack)
        .mockResolvedValueOnce({ ok: false, error: 'Could not write file: EACCES' })
        .mockResolvedValueOnce({ ok: true, filePath: '/home/trainee/my-pack.json' })

      render(<SettingsView />)
      await screen.findByLabelText('Provider')
      const button = scenarioPackSection().getByRole('button', { name: 'Save Scenario Pack…' })
      await user.click(button)
      await scenarioPackSection().findByRole('alert')

      await user.click(button)

      await waitFor(() => expect(scenarioPackSection().queryByRole('alert')).not.toBeInTheDocument())
      expect(await scenarioPackSection().findByText(/my-pack\.json/)).toBeInTheDocument()
    })
  })

  describe('Appearance (061)', () => {
    afterEach(() => {
      delete document.documentElement.dataset.theme
    })

    it('AC1: lists all 4 available color schemes', async () => {
      render(<SettingsView />)

      const select = await screen.findByLabelText('Color scheme')
      const options = within(select).getAllByRole('option').map((option) => option.textContent)
      expect(options).toEqual(['Default (light)', 'Sage (light)', 'Plum (light)', 'Dark'])
    })

    it('prefills the picker from the persisted color scheme', async () => {
      vi.mocked(window.api.data.appearance.get).mockResolvedValue({ colorScheme: 'plum' })

      render(<SettingsView />)

      expect(await screen.findByLabelText('Color scheme')).toHaveValue('plum')
    })

    it('AC2: selecting a scheme applies it to this window immediately, with no Save step', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.appearance.get).mockResolvedValue({ colorScheme: 'default' })

      render(<SettingsView />)

      const select = await screen.findByLabelText('Color scheme')
      expect(appearanceSection().queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

      await user.selectOptions(select, 'dark')

      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(window.api.data.appearance.set).toHaveBeenCalledWith({ colorScheme: 'dark' })
    })

    it('AC3: persists the selection the same way other settings are — through the config API, not just local state', async () => {
      const user = userEvent.setup()
      vi.mocked(window.api.data.appearance.get).mockResolvedValue({ colorScheme: 'default' })

      render(<SettingsView />)

      const select = await screen.findByLabelText('Color scheme')
      await user.selectOptions(select, 'sage')

      await waitFor(() => expect(window.api.data.appearance.set).toHaveBeenCalledWith({ colorScheme: 'sage' }))
    })

    it('AC4: on launch, applies whatever scheme was persisted — not always the default', async () => {
      vi.mocked(window.api.data.appearance.get).mockResolvedValue({ colorScheme: 'dark' })

      render(<SettingsView />)

      await screen.findByLabelText('Color scheme')
      expect(window.api.data.appearance.get).toHaveBeenCalled()
    })
  })
})
