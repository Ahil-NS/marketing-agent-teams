import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ClaudeAuthError} from '../../../src/lib/setup/errors.js'

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('MyProduct'),
  checkbox: vi.fn().mockResolvedValue(['reddit', 'instagram']),
  select: vi.fn().mockResolvedValue('beginner'),
  confirm: vi.fn().mockResolvedValue(true),
}))

// Mock child_process — default: claude found
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(null, 'claude 1.0.0', '')
  }),
}))

describe('wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifyClaude', () => {
    it('resolves when claude CLI is found', async () => {
      const {verifyClaude} = await import('../../../src/lib/setup/wizard.js')
      await expect(verifyClaude()).resolves.toBeUndefined()
    })

    it('throws ClaudeAuthError when claude CLI is not found', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(new Error('command not found'), '', '')
          return undefined as never
        },
      )

      const {verifyClaude} = await import('../../../src/lib/setup/wizard.js')
      await expect(verifyClaude()).rejects.toThrow(ClaudeAuthError)
    })

    it('includes SETUP_CLAUDE_NOT_FOUND error code', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(new Error('command not found'), '', '')
          return undefined as never
        },
      )

      const {verifyClaude} = await import('../../../src/lib/setup/wizard.js')
      try {
        await verifyClaude()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAuthError)
        expect((error as ClaudeAuthError).code).toBe('SETUP_CLAUDE_NOT_FOUND')
        expect((error as ClaudeAuthError).resolution).toContain('Install Claude Code CLI')
      }
    })

    it('throws ClaudeAuthError when claude output is unexpected', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
          cb(null, 'some random output', '')
          return undefined as never
        },
      )

      const {verifyClaude} = await import('../../../src/lib/setup/wizard.js')
      try {
        await verifyClaude()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeAuthError)
        expect((error as ClaudeAuthError).code).toBe('SETUP_CLAUDE_AUTH_FAILED')
      }
    })
  })

  describe('promptWizard', () => {
    it('returns wizard answers with product name, platforms, and skill level', async () => {
      const {promptWizard} = await import('../../../src/lib/setup/wizard.js')
      const answers = await promptWizard()

      expect(answers).toEqual({
        productName: 'MyProduct',
        platforms: ['reddit', 'instagram'],
        skillLevel: 'beginner',
      })
    })

    it('calls input prompt for product name', async () => {
      const prompts = await import('@inquirer/prompts')
      const {promptWizard} = await import('../../../src/lib/setup/wizard.js')
      await promptWizard()

      expect(prompts.input).toHaveBeenCalledWith(
        expect.objectContaining({message: 'Product name:'}),
      )
    })

    it('calls checkbox prompt for platforms', async () => {
      const prompts = await import('@inquirer/prompts')
      const {promptWizard} = await import('../../../src/lib/setup/wizard.js')
      await promptWizard()

      expect(prompts.checkbox).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Target platforms:',
          choices: expect.arrayContaining([
            expect.objectContaining({value: 'reddit'}),
            expect.objectContaining({value: 'tiktok'}),
            expect.objectContaining({value: 'facebook'}),
            expect.objectContaining({value: 'instagram'}),
          ]),
        }),
      )
    })

    it('calls select prompt for skill level with intermediate default', async () => {
      const prompts = await import('@inquirer/prompts')
      const {promptWizard} = await import('../../../src/lib/setup/wizard.js')
      await promptWizard()

      expect(prompts.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Skill level:',
          default: 'intermediate',
        }),
      )
    })

    it('only requires three inputs (NFR28)', async () => {
      const prompts = await import('@inquirer/prompts')
      const {promptWizard} = await import('../../../src/lib/setup/wizard.js')
      await promptWizard()

      // Only 3 prompts: input (product name), checkbox (platforms), select (skill level)
      expect(prompts.input).toHaveBeenCalledTimes(1)
      expect(prompts.checkbox).toHaveBeenCalledTimes(1)
      expect(prompts.select).toHaveBeenCalledTimes(1)
    })
  })
})
