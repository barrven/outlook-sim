// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsView from './SettingsView'
import type { Settings, SystemPromptConfig, TraineeIdentity } from '../../../shared/data-types'

const SETTINGS: Settings = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKeys: { openai: 'sk-openai', anthropic: 'sk-anthropic', gemini: '', xai: '' }
}

const IDENTITY: TraineeIdentity = {
  displayName: 'Jordan Trainee',
  jobTitle: 'Analyst',
  fromEmail: 'jordan.trainee@example.com'
}

const SYSTEM_PROMPT: SystemPromptConfig = {
  systemPrompt: 'Domain: insurance office. Be terse and professional.'
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

  describe('Trainee Identity', () => {
    it('prefills display name, job title, and from email from saved identity', async () => {
      vi.mocked(window.api.data.identity.get).mockResolvedValue(IDENTITY)

      render(<SettingsView />)

      expect(await screen.findByLabelText('Display Name')).toHaveValue('Jordan Trainee')
      expect(screen.getByLabelText('Job Title')).toHaveValue('Analyst')
      expect(screen.getByLabelText('From Email')).toHaveValue('jordan.trainee@example.com')
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
        fromEmail: 'jordan.t@example.com'
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
})
