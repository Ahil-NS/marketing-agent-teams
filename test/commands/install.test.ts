import {existsSync} from 'node:fs'
import {mkdir, readFile} from 'node:fs/promises'
import {join} from 'node:path'

import YAML from 'yaml'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createTestDir, removeTestDir} from '../helpers/test-project.js'

// Mock @inquirer/prompts before importing anything that uses it
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('TestProduct'),
  checkbox: vi.fn().mockResolvedValue(['reddit', 'tiktok']),
  select: vi.fn().mockResolvedValue('intermediate'),
  confirm: vi.fn().mockResolvedValue(true),
}))

// Mock child_process for Claude CLI verification
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, 'claude 1.0.0', '')
  }),
}))

describe('mat install command', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await createTestDir()
    vi.clearAllMocks()
    // Reset execFile to success mock (tests may override it)
    const childProcess = await import('node:child_process')
    vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd: string, _args: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, 'claude 1.0.0', '')
        return undefined as never
      },
    )
  })

  afterEach(async () => {
    await removeTestDir(testDir)
    vi.restoreAllMocks()
  })

  it('exports runSetupWizard and checkExistingProject from lib module', async () => {
    const {runSetupWizard, checkExistingProject} = await import('../../src/lib/setup/index.js')
    expect(runSetupWizard).toBeDefined()
    expect(typeof runSetupWizard).toBe('function')
    expect(checkExistingProject).toBeDefined()
    expect(typeof checkExistingProject).toBe('function')
  })

  describe('checkExistingProject (AC #3)', () => {
    it('returns true when no .mat/ directory exists', async () => {
      const {checkExistingProject} = await import('../../src/lib/setup/index.js')
      const result = await checkExistingProject(testDir)
      expect(result).toBe(true)
    })

    it('prompts for confirmation when .mat/ already exists', async () => {
      await mkdir(join(testDir, '.mat'), {recursive: true})
      const prompts = await import('@inquirer/prompts')
      const {checkExistingProject} = await import('../../src/lib/setup/index.js')

      await checkExistingProject(testDir)
      expect(prompts.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already exists'),
          default: false,
        }),
      )
    })

    it('returns false when user declines overwrite', async () => {
      await mkdir(join(testDir, '.mat'), {recursive: true})
      const prompts = await import('@inquirer/prompts')
      vi.mocked(prompts.confirm).mockResolvedValueOnce(false)

      const {checkExistingProject} = await import('../../src/lib/setup/index.js')
      const result = await checkExistingProject(testDir)
      expect(result).toBe(false)
    })

    it('returns true when user confirms overwrite', async () => {
      await mkdir(join(testDir, '.mat'), {recursive: true})
      const prompts = await import('@inquirer/prompts')
      vi.mocked(prompts.confirm).mockResolvedValueOnce(true)

      const {checkExistingProject} = await import('../../src/lib/setup/index.js')
      const result = await checkExistingProject(testDir)
      expect(result).toBe(true)
    })
  })

  describe('runSetupWizard', () => {
    it('creates .mat/ directory with full structure', async () => {
      const {runSetupWizard} = await import('../../src/lib/setup/index.js')
      await runSetupWizard(testDir)

      expect(existsSync(join(testDir, '.mat'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'config.yaml'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'state', 'pipeline-runs'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'state', 'review-queue'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'state', 'retry-queue'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'agents'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'content'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'credentials'))).toBe(true)
      expect(existsSync(join(testDir, '.mat', 'logs'))).toBe(true)
    })

    it('writes config.yaml with wizard answers', async () => {
      const {runSetupWizard} = await import('../../src/lib/setup/index.js')
      await runSetupWizard(testDir)

      const content = await readFile(join(testDir, '.mat', 'config.yaml'), 'utf-8')
      const config = YAML.parse(content)
      expect(config.productName).toBe('TestProduct')
      expect(config.platforms).toEqual(['reddit', 'tiktok'])
      expect(config.skillLevel).toBe('intermediate')
    })

    it('verifies Claude Code CLI before prompting', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(new Error('not found'), '', '')
          return undefined as never
        },
      )

      const {runSetupWizard} = await import('../../src/lib/setup/index.js')
      await expect(runSetupWizard(testDir)).rejects.toThrow('Claude Code CLI not found')
    })

    it('creates credentials/platforms.json with empty metadata', async () => {
      const {runSetupWizard} = await import('../../src/lib/setup/index.js')
      await runSetupWizard(testDir)

      const content = await readFile(join(testDir, '.mat', 'credentials', 'platforms.json'), 'utf-8')
      const creds = JSON.parse(content)
      expect(creds).toEqual({platforms: {}})
    })
  })
})
