import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

describe('claude-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifyClaudeAuth', () => {
    it('returns version string when claude CLI is installed and authenticated', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
          cb(null, 'claude 1.2.3')
          return undefined as never
        },
      )

      const {verifyClaudeAuth} = await import('../../../src/lib/auth/claude-auth.js')
      const version = await verifyClaudeAuth()
      expect(version).toBe('claude 1.2.3')
    })

    it('throws ClaudeNotInstalledError when claude CLI is not found (ENOENT)', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
          const error = new Error('spawn claude ENOENT') as NodeJS.ErrnoException
          error.code = 'ENOENT'
          cb(error)
          return undefined as never
        },
      )

      const {verifyClaudeAuth} = await import('../../../src/lib/auth/claude-auth.js')
      const {ClaudeNotInstalledError} = await import('../../../src/lib/auth/errors.js')
      await expect(verifyClaudeAuth()).rejects.toThrow(ClaudeNotInstalledError)
    })

    it('ClaudeNotInstalledError has correct code and resolution', async () => {
      const {ClaudeNotInstalledError} = await import('../../../src/lib/auth/errors.js')
      const error = new ClaudeNotInstalledError()
      expect(error.code).toBe('AUTH_CLAUDE_NOT_INSTALLED')
      expect(error.resolution).toContain('https://claude.com/download')
      expect(error.severity).toBe('permanent')
    })

    it('throws ClaudeNotAuthenticatedError on non-zero exit code', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
          const error = new Error('Command failed with exit code 1')
          cb(error)
          return undefined as never
        },
      )

      const {verifyClaudeAuth} = await import('../../../src/lib/auth/claude-auth.js')
      const {ClaudeNotAuthenticatedError} = await import('../../../src/lib/auth/errors.js')
      await expect(verifyClaudeAuth()).rejects.toThrow(ClaudeNotAuthenticatedError)
    })

    it('ClaudeNotAuthenticatedError has correct code and resolution', async () => {
      const {ClaudeNotAuthenticatedError} = await import('../../../src/lib/auth/errors.js')
      const error = new ClaudeNotAuthenticatedError()
      expect(error.code).toBe('AUTH_CLAUDE_NOT_AUTHENTICATED')
      expect(error.resolution).toContain('claude login')
      expect(error.severity).toBe('permanent')
    })

    it('calls execFile with claude --version and 5s timeout', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
          cb(null, 'claude 1.0.0')
          return undefined as never
        },
      )

      const {verifyClaudeAuth} = await import('../../../src/lib/auth/claude-auth.js')
      await verifyClaudeAuth()

      expect(childProcess.execFile).toHaveBeenCalledWith(
        'claude',
        ['--version'],
        {timeout: 5000},
        expect.any(Function),
      )
    })
  })
})
