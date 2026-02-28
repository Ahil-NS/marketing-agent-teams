import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import YAML from 'yaml'

import {MATError} from '../../../src/lib/utils/errors.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('mat config agents command', () => {
  let testDir: string
  let originalCwd: string

  const validConfig = {
    productName: 'TestBrand',
    platforms: ['reddit'],
    skillLevel: 'intermediate',
    brandVoice: {
      tone: 'professional',
      communicationStyle: 'clear and direct',
      brandPrinciples: [],
      bannedPhrases: [],
    },
    agents: {
      defaultModel: 'sonnet',
      budgetLimit: 10,
      toggles: {},
    },
  }

  // oclif this.parse() requires config.runHook for 'preparse' hook
  const mockConfig = {runHook: vi.fn().mockResolvedValue({successes: [], failures: []})} as never

  beforeEach(async () => {
    testDir = await createTestDir()
    originalCwd = process.cwd()
    process.chdir(testDir)
    await mkdir(join(testDir, '.mat'), {recursive: true})
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(validConfig), 'utf-8')
    vi.clearAllMocks()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await removeTestDir(testDir)
  })

  it('lists all agents grouped by cluster', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents([], mockConfig)
    cmd.log = vi.fn()

    const result = await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('Intelligence')
    expect(logs).toContain('trend-scout')
    expect(logs).toContain('Creation')
    expect(logs).toContain('hook-writer')
    expect(result).toHaveProperty('intelligence')
    expect(result).toHaveProperty('coordination')
  })

  it('disables an agent and persists to config', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents(['--disable', 'trend-scout'], mockConfig)
    cmd.log = vi.fn()

    const result = await cmd.run()

    expect(result).toEqual({agent: 'trend-scout', enabled: false})
    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)
    expect(config.agents.toggles['trend-scout'].enabled).toBe(false)
  })

  it('enables a previously disabled agent', async () => {
    const configWithDisabled = {
      ...validConfig,
      agents: {...validConfig.agents, toggles: {'trend-scout': {enabled: false}}},
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(configWithDisabled), 'utf-8')

    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents(['--enable', 'trend-scout'], mockConfig)
    cmd.log = vi.fn()

    const result = await cmd.run()

    expect(result).toEqual({agent: 'trend-scout', enabled: true})
    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)
    expect(config.agents.toggles['trend-scout'].enabled).toBe(true)
  })

  it('preserves other config sections when toggling', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents(['--disable', 'trend-scout'], mockConfig)
    cmd.log = vi.fn()
    await cmd.run()

    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)
    expect(config.productName).toBe('TestBrand')
    expect(config.platforms).toEqual(['reddit'])
    expect(config.agents.defaultModel).toBe('sonnet')
  })

  it('rejects unknown agent name with MATError', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents(['--disable', 'trend-scoat'], mockConfig)
    cmd.log = vi.fn()

    await expect(cmd.run()).rejects.toThrow(MATError)
  })

  it('displays confirmation after toggle', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents(['--disable', 'hook-writer'], mockConfig)
    cmd.log = vi.fn()
    await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('hook-writer')
    expect(logs).toContain('disabled')
  })

  it('has enableJsonFlag set to true', async () => {
    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    expect(ConfigAgents.enableJsonFlag).toBe(true)
  })

  it('shows disabled agent status in listing', async () => {
    const configWithDisabled = {
      ...validConfig,
      agents: {...validConfig.agents, toggles: {'trend-scout': {enabled: false}}},
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(configWithDisabled), 'utf-8')

    const {default: ConfigAgents} = await import('../../../src/commands/config/agents.js')
    const cmd = new ConfigAgents([], mockConfig)
    cmd.log = vi.fn()

    const result = await cmd.run() as Record<string, {name: string; enabled: boolean}[]>
    const trendScout = result.intelligence.find(a => a.name === 'trend-scout')
    expect(trendScout?.enabled).toBe(false)
  })
})
