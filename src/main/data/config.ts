import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { LlmProvider, Persona, PersonasConfig, Settings, SystemPromptConfig, TraineeIdentity } from '../../shared/data-types'

const CONFIG_DIR_NAME = 'config'

const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  model: '',
  apiKeys: {
    openai: '',
    anthropic: '',
    gemini: '',
    xai: ''
  } satisfies Record<LlmProvider, string>
}

const DEFAULT_SYSTEM_PROMPT: SystemPromptConfig = {
  systemPrompt: ''
}

const DEFAULT_IDENTITY: TraineeIdentity = {
  displayName: '',
  jobTitle: '',
  fromEmail: ''
}

const DEFAULT_PERSONAS: PersonasConfig = {
  personas: []
}

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(fallback, null, 2))
    return fallback
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function writeJsonFile<T>(path: string, value: T): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

export class ConfigStore {
  private settingsPath: string
  private systemPromptPath: string
  private identityPath: string
  private personasPath: string

  constructor(baseDir: string) {
    const configDir = join(baseDir, CONFIG_DIR_NAME)
    mkdirSync(configDir, { recursive: true })
    this.settingsPath = join(configDir, 'settings.json')
    this.systemPromptPath = join(configDir, 'system-prompt.json')
    this.identityPath = join(configDir, 'identity.json')
    this.personasPath = join(configDir, 'personas.json')

    // Ensure every config file exists on first run.
    readJsonFile(this.settingsPath, DEFAULT_SETTINGS)
    readJsonFile(this.systemPromptPath, DEFAULT_SYSTEM_PROMPT)
    readJsonFile(this.identityPath, DEFAULT_IDENTITY)
    readJsonFile(this.personasPath, DEFAULT_PERSONAS)
  }

  getSettings(): Settings {
    return readJsonFile(this.settingsPath, DEFAULT_SETTINGS)
  }

  setSettings(settings: Settings): void {
    writeJsonFile(this.settingsPath, settings)
  }

  getSystemPrompt(): SystemPromptConfig {
    return readJsonFile(this.systemPromptPath, DEFAULT_SYSTEM_PROMPT)
  }

  setSystemPrompt(config: SystemPromptConfig): void {
    writeJsonFile(this.systemPromptPath, config)
  }

  getIdentity(): TraineeIdentity {
    return readJsonFile(this.identityPath, DEFAULT_IDENTITY)
  }

  setIdentity(identity: TraineeIdentity): void {
    writeJsonFile(this.identityPath, identity)
  }

  getPersonas(): Persona[] {
    return readJsonFile(this.personasPath, DEFAULT_PERSONAS).personas
  }

  setPersonas(personas: Persona[]): void {
    writeJsonFile(this.personasPath, { personas })
  }
}
