import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  AppearanceConfig,
  LlmFailureLogEntry,
  LlmProvider,
  Persona,
  PersonasConfig,
  ScheduledScenarioMessage,
  SchedulerState,
  Settings,
  SystemPromptConfig,
  TraineeIdentity
} from '../../shared/data-types'

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

// A fresh install applies the revised default scheme from feature 058
// (AC4), not any of the later 059/060 additions.
const DEFAULT_APPEARANCE: AppearanceConfig = {
  colorScheme: 'default'
}

const DEFAULT_IDENTITY: TraineeIdentity = {
  displayName: '',
  jobTitle: '',
  fromEmail: '',
  reportsTo: '',
  department: ''
}

const DEFAULT_PERSONAS: PersonasConfig = {
  personas: []
}

const DEFAULT_SCHEDULER_STATE: SchedulerState = {
  nextDueSimTime: 0
}

const DEFAULT_SCHEDULED_SCENARIO_MESSAGES: ScheduledScenarioMessage[] = []

const DEFAULT_LLM_FAILURE_LOG: LlmFailureLogEntry[] = []

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
  private appearancePath: string
  private identityPath: string
  private personasPath: string
  private schedulerPath: string
  private scheduledScenarioMessagesPath: string
  private llmFailureLogPath: string

  constructor(baseDir: string) {
    const configDir = join(baseDir, CONFIG_DIR_NAME)
    mkdirSync(configDir, { recursive: true })
    this.settingsPath = join(configDir, 'settings.json')
    this.systemPromptPath = join(configDir, 'system-prompt.json')
    this.appearancePath = join(configDir, 'appearance.json')
    this.identityPath = join(configDir, 'identity.json')
    this.personasPath = join(configDir, 'personas.json')
    this.schedulerPath = join(configDir, 'scheduler.json')
    this.scheduledScenarioMessagesPath = join(configDir, 'scenario-scheduled-messages.json')
    this.llmFailureLogPath = join(configDir, 'llm-failure-log.json')

    // Ensure every config file exists on first run.
    readJsonFile(this.settingsPath, DEFAULT_SETTINGS)
    readJsonFile(this.systemPromptPath, DEFAULT_SYSTEM_PROMPT)
    readJsonFile(this.appearancePath, DEFAULT_APPEARANCE)
    readJsonFile(this.identityPath, DEFAULT_IDENTITY)
    readJsonFile(this.personasPath, DEFAULT_PERSONAS)
    readJsonFile(this.schedulerPath, DEFAULT_SCHEDULER_STATE)
    readJsonFile(this.scheduledScenarioMessagesPath, DEFAULT_SCHEDULED_SCENARIO_MESSAGES)
    readJsonFile(this.llmFailureLogPath, DEFAULT_LLM_FAILURE_LOG)
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

  getAppearance(): AppearanceConfig {
    return readJsonFile(this.appearancePath, DEFAULT_APPEARANCE)
  }

  setAppearance(config: AppearanceConfig): void {
    writeJsonFile(this.appearancePath, config)
  }

  // Merges over `DEFAULT_IDENTITY` rather than returning the parsed file
  // as-is — identity data saved before feature 028 (org-structure fields)
  // lacks `reportsTo`/`department`, and this guarantees every reader gets
  // '' for them instead of `undefined` (AC4).
  getIdentity(): TraineeIdentity {
    return { ...DEFAULT_IDENTITY, ...readJsonFile(this.identityPath, DEFAULT_IDENTITY) }
  }

  setIdentity(identity: TraineeIdentity): void {
    writeJsonFile(this.identityPath, identity)
  }

  // Same reasoning as `getIdentity` above, per-persona: a persona saved
  // before feature 028 lacks `reportsTo`, and this guarantees '' instead
  // of `undefined` for every persona, regardless of when it was saved.
  getPersonas(): Persona[] {
    return readJsonFile(this.personasPath, DEFAULT_PERSONAS).personas.map((persona) => ({
      ...persona,
      reportsTo: persona.reportsTo ?? ''
    }))
  }

  setPersonas(personas: Persona[]): void {
    writeJsonFile(this.personasPath, { personas })
  }

  getSchedulerState(): SchedulerState {
    return readJsonFile(this.schedulerPath, DEFAULT_SCHEDULER_STATE)
  }

  setSchedulerState(state: SchedulerState): void {
    writeJsonFile(this.schedulerPath, state)
  }

  getScheduledScenarioMessages(): ScheduledScenarioMessage[] {
    return readJsonFile(this.scheduledScenarioMessagesPath, DEFAULT_SCHEDULED_SCENARIO_MESSAGES)
  }

  setScheduledScenarioMessages(messages: ScheduledScenarioMessage[]): void {
    writeJsonFile(this.scheduledScenarioMessagesPath, messages)
  }

  getLlmFailureLog(): LlmFailureLogEntry[] {
    return readJsonFile(this.llmFailureLogPath, DEFAULT_LLM_FAILURE_LOG)
  }

  // Appends rather than replaces — every LLM call failure (persona reply,
  // unsolicited mail, Test Connection) is recorded here regardless of
  // whether its UI banner/message was later dismissed, so the log stays a
  // durable, independent history of failures.
  appendLlmFailureLog(entry: LlmFailureLogEntry): void {
    writeJsonFile(this.llmFailureLogPath, [...this.getLlmFailureLog(), entry])
  }
}
