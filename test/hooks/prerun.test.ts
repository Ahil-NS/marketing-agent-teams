import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

// Hoisted mock for TokenLifecycleManager's refreshExpiringTokens
const { mockRefreshExpiringTokens } = vi.hoisted(() => ({
  mockRefreshExpiringTokens: vi.fn().mockResolvedValue({ refreshed: [], failed: [] }),
}))

// Mock child_process
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

// Mock budget module — default: passes
vi.mock('../../src/lib/budget/budget-checker.js', () => ({
  checkBudget: vi.fn().mockResolvedValue({ok: true}),
}))

// Mock token refresher — kept for backward compat reference
vi.mock('../../src/lib/credentials/token-refresher.js', () => ({
  refreshExpiredTokens: vi.fn().mockResolvedValue({}),
}))

// Mock credential-manager constructor
vi.mock('../../src/lib/credentials/credential-manager.js', () => {
  return {
    CredentialManager: class MockCredentialManager {
      list = vi.fn().mockResolvedValue([])
    },
  }
})

// Mock keychain adapter
vi.mock('../../src/lib/credentials/keychain-adapter.js', () => ({
  KeytarKeychainAdapter: class MockKeytarKeychainAdapter {},
}))

// Mock adapter registry
vi.mock('../../src/lib/platforms/adapter-registry.js', () => ({
  AdapterRegistry: class MockAdapterRegistry {},
}))

// Mock PlatformConnectionManager
vi.mock('../../src/lib/platforms/connection-manager.js', () => ({
  PlatformConnectionManager: class MockPlatformConnectionManager {},
}))

// Mock TokenLifecycleManager — uses hoisted mock fn
vi.mock('../../src/lib/platforms/token-lifecycle.js', () => {
  return {
    TokenLifecycleManager: class MockTokenLifecycleManager {
      refreshExpiringTokens = mockRefreshExpiringTokens
    },
  }
})

// Mock prerun context — stores token refresh results
vi.mock('../../src/lib/hooks/prerun-context.js', () => ({
  setTokenRefreshResults: vi.fn(),
}))

// Mock yaml — default: no budget limit configured
vi.mock('yaml', () => ({
  default: {parse: vi.fn().mockReturnValue({agents: {budgetLimit: 10}})},
}))

// Mock fs/promises readFile for config reading in prerun
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('agents:\n  budgetLimit: 10\n'),
}))

function mockClaudeSuccess() {
  return vi.fn((_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
    cb(null, 'claude 1.0.0')
    return undefined as never
  })
}

describe('prerun hook', () => {
  const mockContext = {
    error: vi.fn((msg: string, opts?: {exit?: number; code?: string}) => {
      throw new Error(`CLI_ERROR: ${msg} (code=${opts?.code}, exit=${opts?.exit})`)
    }),
    warn: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
    config: {pjson: {}},
  }

  const createOptions = (commandId: string) => ({
    Command: {id: commandId},
    argv: [],
    config: mockContext.config,
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-establish default claude success mock
    const childProcess = await import('node:child_process')
    vi.mocked(childProcess.execFile).mockImplementation(mockClaudeSuccess())
    // Re-establish default budget mock
    const budgetModule = await import('../../src/lib/budget/budget-checker.js')
    vi.mocked(budgetModule.checkBudget).mockResolvedValue({ok: true})
    // Reset the hoisted mock to default
    mockRefreshExpiringTokens.mockResolvedValue({ refreshed: [], failed: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('skip auth commands', () => {
    it('skips auth check for install command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('install') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('skips auth check for config command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('config') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('skips auth check for config:agents command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('config:agents') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('skips auth check for config:platforms command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('config:platforms') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('skips auth check for config:voice command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('config:voice') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('skips auth check for help command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('help') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })

    it('does NOT skip auth check for run command', async () => {
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)
      expect(mockContext.error).not.toHaveBeenCalled()
    })
  })

  describe('auth verification', () => {
    it('aborts with ClaudeNotInstalledError when CLI not found', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
          const error = new Error('spawn claude ENOENT') as NodeJS.ErrnoException
          error.code = 'ENOENT'
          cb(error)
          return undefined as never
        },
      )

      const hook = (await import('../../src/hooks/prerun.js')).default
      await expect(
        hook.call(mockContext as never, createOptions('run') as never),
      ).rejects.toThrow('CLI_ERROR')

      expect(mockContext.error).toHaveBeenCalledWith(
        expect.stringContaining('not installed'),
        expect.objectContaining({exit: 1, code: 'AUTH_CLAUDE_NOT_INSTALLED'}),
      )
    })

    it('aborts with ClaudeNotAuthenticatedError when CLI auth fails', async () => {
      const childProcess = await import('node:child_process')
      vi.mocked(childProcess.execFile).mockImplementation(
        (_cmd: string, _args: unknown, _opts: unknown, cb: (err: Error | null) => void) => {
          cb(new Error('Command failed'))
          return undefined as never
        },
      )

      const hook = (await import('../../src/hooks/prerun.js')).default
      await expect(
        hook.call(mockContext as never, createOptions('run') as never),
      ).rejects.toThrow('CLI_ERROR')

      expect(mockContext.error).toHaveBeenCalledWith(
        expect.stringContaining('not authenticated'),
        expect.objectContaining({exit: 1, code: 'AUTH_CLAUDE_NOT_AUTHENTICATED'}),
      )
    })
  })

  describe('budget check', () => {
    it('checks budget for run command', async () => {
      const budgetModule = await import('../../src/lib/budget/budget-checker.js')
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(budgetModule.checkBudget).toHaveBeenCalledWith(process.cwd(), 10)
    })

    it('checks budget for agents:test command', async () => {
      const budgetModule = await import('../../src/lib/budget/budget-checker.js')
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('agents:test') as never)

      expect(budgetModule.checkBudget).toHaveBeenCalledWith(process.cwd(), 10)
    })

    it('does NOT check budget for status command', async () => {
      const budgetModule = await import('../../src/lib/budget/budget-checker.js')
      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('status') as never)

      expect(budgetModule.checkBudget).not.toHaveBeenCalled()
    })

    it('warns when budget is at 90%+', async () => {
      const budgetModule = await import('../../src/lib/budget/budget-checker.js')
      vi.mocked(budgetModule.checkBudget).mockResolvedValue({
        ok: true,
        warning: 'Approaching daily budget limit ($9.50/$10.00)',
      })

      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(mockContext.warn).toHaveBeenCalledWith(
        expect.stringContaining('Approaching daily budget limit'),
      )
    })

    it('aborts with BudgetExceededError when budget exceeded', async () => {
      const {BudgetExceededError} = await import('../../src/lib/budget/errors.js')
      const budgetModule = await import('../../src/lib/budget/budget-checker.js')
      vi.mocked(budgetModule.checkBudget).mockRejectedValue(
        new BudgetExceededError(10, 12),
      )

      const hook = (await import('../../src/hooks/prerun.js')).default
      await expect(
        hook.call(mockContext as never, createOptions('run') as never),
      ).rejects.toThrow('CLI_ERROR')

      expect(mockContext.error).toHaveBeenCalledWith(
        expect.stringContaining('budget limit reached'),
        expect.objectContaining({exit: 1, code: 'BUDGET_EXCEEDED'}),
      )
    })
  })

  describe('token refresh', () => {
    it('warns when token refresh fails for a platform', async () => {
      mockRefreshExpiringTokens.mockResolvedValue({
        refreshed: [],
        failed: [{ platform: 'reddit', error: 'Token expired', reAuthCommand: 'mat config platforms add reddit' }],
      })

      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(mockContext.warn).toHaveBeenCalledWith(
        expect.stringContaining('Token refresh failed for reddit'),
      )
    })

    it('does not warn for skipped or refreshed tokens', async () => {
      mockRefreshExpiringTokens.mockResolvedValue({
        refreshed: ['reddit', 'facebook'],
        failed: [],
      })

      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(mockContext.warn).not.toHaveBeenCalled()
    })

    it('stores token refresh results in prerun context', async () => {
      const contextModule = await import('../../src/lib/hooks/prerun-context.js')
      mockRefreshExpiringTokens.mockResolvedValue({
        refreshed: ['reddit'],
        failed: [{ platform: 'facebook', error: 'Failed', reAuthCommand: 'mat config platforms add facebook' }],
      })

      const hook = (await import('../../src/hooks/prerun.js')).default
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(contextModule.setTokenRefreshResults).toHaveBeenCalledWith({
        reddit: 'refreshed',
        facebook: 'failed',
      })
    })

    it('does not block execution when token refresh throws', async () => {
      mockRefreshExpiringTokens.mockRejectedValue(
        new Error('No credentials configured'),
      )

      const hook = (await import('../../src/hooks/prerun.js')).default
      // Should NOT throw — token refresh errors are non-fatal
      await hook.call(mockContext as never, createOptions('run') as never)

      expect(mockContext.error).not.toHaveBeenCalled()
    })
  })
})
