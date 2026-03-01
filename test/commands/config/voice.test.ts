import {readFile, mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import YAML from 'yaml'

import {MATError} from '../../../src/lib/utils/errors.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  editor: vi.fn(),
}))

describe('mat config voice', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    testDir = await createTestDir()
    originalCwd = process.cwd()
    process.chdir(testDir)

    // Create .mat directory with a valid config
    await mkdir(join(testDir, '.mat'), {recursive: true})
    const config = {
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
      },
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(config), 'utf-8')

    vi.clearAllMocks()
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await removeTestDir(testDir)
  })

  it('saves brand voice settings to config.yaml', async () => {
    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.select).mockResolvedValueOnce('friendly')
    vi.mocked(prompts.select).mockResolvedValueOnce('conversational')
    vi.mocked(prompts.editor).mockResolvedValueOnce('Be authentic\nStay curious')
    vi.mocked(prompts.input).mockResolvedValueOnce('synergy, leverage, disrupt')

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()
    await cmd.run()

    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)

    expect(config.brandVoice.tone).toBe('friendly')
    expect(config.brandVoice.communicationStyle).toBe('conversational')
    expect(config.brandVoice.brandPrinciples).toEqual(['Be authentic', 'Stay curious'])
    expect(config.brandVoice.bannedPhrases).toEqual(['synergy', 'leverage', 'disrupt'])
    expect(vi.mocked(cmd.log)).toHaveBeenCalledWith(expect.stringContaining('Brand voice configuration saved'))
  })

  it('preserves other config sections when saving', async () => {
    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.select).mockResolvedValueOnce('enthusiastic')
    vi.mocked(prompts.select).mockResolvedValueOnce('inspirational')
    vi.mocked(prompts.editor).mockResolvedValueOnce('')
    vi.mocked(prompts.input).mockResolvedValueOnce('')

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()
    await cmd.run()

    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)

    expect(config.productName).toBe('TestBrand')
    expect(config.platforms).toEqual(['reddit'])
    expect(config.skillLevel).toBe('intermediate')
    expect(config.agents.defaultModel).toBe('sonnet')
  })

  it('pre-populates prompts with existing values (AC #3)', async () => {
    const existingConfig = {
      productName: 'TestBrand',
      platforms: ['reddit'],
      skillLevel: 'intermediate',
      brandVoice: {
        tone: 'friendly',
        communicationStyle: 'conversational',
        brandPrinciples: ['Be real'],
        bannedPhrases: ['synergy'],
      },
      agents: {defaultModel: 'sonnet', budgetLimit: 10},
    }
    await writeFile(join(testDir, '.mat', 'config.yaml'), YAML.stringify(existingConfig), 'utf-8')

    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.select).mockResolvedValueOnce('friendly')
    vi.mocked(prompts.select).mockResolvedValueOnce('conversational')
    vi.mocked(prompts.editor).mockResolvedValueOnce('Be real')
    vi.mocked(prompts.input).mockResolvedValueOnce('synergy')

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()
    await cmd.run()

    // Verify select was called with default matching existing value
    expect(vi.mocked(prompts.select).mock.calls[0][0]).toHaveProperty('default', 'friendly')
    expect(vi.mocked(prompts.select).mock.calls[1][0]).toHaveProperty('default', 'conversational')
    // Verify editor was called with existing principles joined
    expect(vi.mocked(prompts.editor).mock.calls[0][0]).toHaveProperty('default', 'Be real')
    // Verify input was called with existing banned phrases joined
    expect(vi.mocked(prompts.input).mock.calls[0][0]).toHaveProperty('default', 'synergy')
  })

  it('handles empty brandPrinciples and bannedPhrases input', async () => {
    const prompts = await import('@inquirer/prompts')
    vi.mocked(prompts.select).mockResolvedValueOnce('professional')
    vi.mocked(prompts.select).mockResolvedValueOnce('formal')
    vi.mocked(prompts.editor).mockResolvedValueOnce('')
    vi.mocked(prompts.input).mockResolvedValueOnce('')

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()
    await cmd.run()

    const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
    const config = YAML.parse(content)

    expect(config.brandVoice.brandPrinciples).toEqual([])
    expect(config.brandVoice.bannedPhrases).toEqual([])
  })

  it('throws MATError when config.yaml is missing', async () => {
    // Remove config.yaml
    const {unlink} = await import('node:fs/promises')
    await unlink(join(testDir, '.mat', 'config.yaml'))

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()

    await expect(cmd.run()).rejects.toThrow(MATError)
    try {
      await cmd.run()
    } catch (error) {
      expect((error as MATError).code).toBe('CONFIG_READ_FAILED')
    }
  })

  it('throws MATError when config.yaml is invalid', async () => {
    await writeFile(join(testDir, '.mat', 'config.yaml'), 'not: valid\nconfig: true\n', 'utf-8')

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()

    await expect(cmd.run()).rejects.toThrow(MATError)
    try {
      await cmd.run()
    } catch (error) {
      expect((error as MATError).code).toBe('CONFIG_VALIDATION_FAILED')
    }
  })

  it('handles Ctrl+C cancellation gracefully', async () => {
    const prompts = await import('@inquirer/prompts')
    const exitError = new Error('User force closed the prompt')
    exitError.name = 'ExitPromptError'
    vi.mocked(prompts.select).mockRejectedValueOnce(exitError)

    const {default: ConfigVoice} = await import('../../../src/commands/config/voice.js')
    const cmd = new ConfigVoice([], {} as never)
    cmd.log = vi.fn()
    await cmd.run()

    expect(vi.mocked(cmd.log)).toHaveBeenCalledWith('\nBrand voice configuration cancelled.')
  })
})
