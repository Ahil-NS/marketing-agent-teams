import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import YAML from 'yaml'

import {MATError} from '../../../src/lib/utils/errors.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('mat config', () => {
  let testDir: string
  let originalCwd: string

  const validConfig = {
    productName: 'TestBrand',
    platforms: ['reddit', 'tiktok'],
    skillLevel: 'intermediate',
    brandVoice: {
      tone: 'friendly',
      communicationStyle: 'conversational',
      brandPrinciples: ['Be authentic'],
      bannedPhrases: ['synergy'],
    },
    agents: {
      defaultModel: 'sonnet',
      budgetLimit: 10,
    },
  }

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

  it('displays current configuration in human-readable format (AC1)', async () => {
    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('TestBrand')
    expect(logs).toContain('reddit')
    expect(logs).toContain('tiktok')
    expect(logs).toContain('friendly')
    expect(logs).toContain('conversational')
  })

  it('returns config object for JSON serialization (AC3)', async () => {
    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    const result = await cmd.run()

    expect(result).toBeDefined()
    expect(result.productName).toBe('TestBrand')
    expect(result.platforms).toEqual(['reddit', 'tiktok'])
    expect(result.brandVoice.tone).toBe('friendly')
    expect(result.agents.defaultModel).toBe('sonnet')
  })

  it('has enableJsonFlag set to true', async () => {
    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    expect(ConfigIndex.enableJsonFlag).toBe(true)
  })

  it('throws MATError when config.yaml is missing', async () => {
    const {unlink} = await import('node:fs/promises')
    await unlink(join(testDir, '.mat', 'config.yaml'))

    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await expect(cmd.run()).rejects.toThrow(MATError)
  })

  it('throws MATError when config.yaml is invalid', async () => {
    await writeFile(join(testDir, '.mat', 'config.yaml'), 'invalid: true\n', 'utf-8')

    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await expect(cmd.run()).rejects.toThrow(MATError)
  })

  it('displays brand principles and banned phrases', async () => {
    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('Be authentic')
    expect(logs).toContain('synergy')
  })

  it('displays agents section', async () => {
    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('sonnet')
    expect(logs).toContain('10')
    expect(logs).toContain('all enabled')
  })

  it('displays disabled agent toggles', async () => {
    const configWithToggles = {
      ...validConfig,
      agents: {...validConfig.agents, toggles: {'trend-scout': {enabled: false}}},
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(configWithToggles), 'utf-8')

    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    await cmd.run()

    const logs = vi.mocked(cmd.log).mock.calls.map(c => c[0]).join('\n')
    expect(logs).toContain('1 disabled')
    expect(logs).toContain('trend-scout')
  })

  it('returns complete config structure for JSON serialization (AC3)', async () => {
    const configWithToggles = {
      ...validConfig,
      agents: {...validConfig.agents, toggles: {'trend-scout': {enabled: false}}},
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(configWithToggles), 'utf-8')

    const {default: ConfigIndex} = await import('../../../src/commands/config/index.js')
    const cmd = new ConfigIndex([], {} as never)
    cmd.log = vi.fn()

    const result = await cmd.run()

    expect(result).toHaveProperty('productName')
    expect(result).toHaveProperty('platforms')
    expect(result).toHaveProperty('brandVoice')
    expect(result).toHaveProperty('agents')
    expect(result.agents).toHaveProperty('toggles')
    expect(result.agents.toggles['trend-scout'].enabled).toBe(false)
  })
})
