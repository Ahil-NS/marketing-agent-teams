import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock the installed-agents module
const mockHolder: {registry: Record<string, ReturnType<typeof vi.fn>>} = {
  registry: {
    getAgent: vi.fn().mockResolvedValue(undefined),
    removeAgent: vi.fn().mockResolvedValue(true),
    addAgent: vi.fn(),
    loadRegistry: vi.fn(),
    listAll: vi.fn(),
    saveRegistry: vi.fn(),
  },
}

vi.mock('../../../src/lib/agents/installed-agents.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/agents/installed-agents.js')>()
  const RegistryClass = vi.fn().mockImplementation(function (this: unknown) {
    return mockHolder.registry
  })
  return {
    ...actual,
    InstalledAgentsRegistry: RegistryClass,
  }
})

// Mock node:fs/promises for trust-overrides cleanup
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  }
})

describe('AgentsRemove command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have required package arg in command definition', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')

    expect(AgentsRemoveCommand.args).toHaveProperty('package')
    expect(AgentsRemoveCommand.args.package).toMatchObject({
      required: true,
    })
  })

  it('should have correct description', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')
    expect(AgentsRemoveCommand.description).toContain('Remove')
    expect(AgentsRemoveCommand.description).toContain('community')
  })

  it('should have examples defined', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')
    expect(AgentsRemoveCommand.examples).toBeDefined()
    expect(AgentsRemoveCommand.examples!.length).toBeGreaterThan(0)
  })

  it('should uninstall and deregister a valid community agent', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')

    const mockGetAgent = vi.fn().mockResolvedValue({
      package: '@community/test-agent',
      version: '1.0.0',
      installedAt: '2026-03-01T00:00:00Z',
      trustTier: 'community',
      agents: ['test-agent'],
      enabled: true,
    })
    const mockRemoveAgent = vi.fn().mockResolvedValue(true)

    mockHolder.registry = {
      getAgent: mockGetAgent,
      removeAgent: mockRemoveAgent,
      addAgent: vi.fn(),
      loadRegistry: vi.fn(),
      listAll: vi.fn(),
      saveRegistry: vi.fn(),
    }

    const mockRunCommand = vi.fn().mockResolvedValue(undefined)
    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsRemoveCommand(['@community/test-agent'], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy

    await cmd.run()

    expect(mockRunCommand).toHaveBeenCalledWith('plugins:uninstall', ['@community/test-agent'])
    expect(mockRemoveAgent).toHaveBeenCalledWith('@community/test-agent')
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Removed community agent'))
  })

  it('should error when package is not installed', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')

    mockHolder.registry = {
      getAgent: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn(),
      addAgent: vi.fn(),
      loadRegistry: vi.fn(),
      listAll: vi.fn(),
      saveRegistry: vi.fn(),
    }

    const mockConfig = {
      runCommand: vi.fn(),
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsRemoveCommand(['@community/nonexistent'], mockConfig)

    await expect(cmd.run()).rejects.toThrow()
  })

  it('should continue deregistration even if plugin uninstall fails', async () => {
    const {default: AgentsRemoveCommand} = await import('../../../src/commands/agents/remove.js')

    const mockRemoveAgent = vi.fn().mockResolvedValue(true)

    mockHolder.registry = {
      getAgent: vi.fn().mockResolvedValue({
        package: '@community/broken-uninstall',
        version: '1.0.0',
        installedAt: '2026-03-01T00:00:00Z',
        trustTier: 'community',
        agents: ['broken-agent'],
        enabled: true,
      }),
      removeAgent: mockRemoveAgent,
      addAgent: vi.fn(),
      loadRegistry: vi.fn(),
      listAll: vi.fn(),
      saveRegistry: vi.fn(),
    }

    const mockRunCommand = vi.fn().mockRejectedValue(new Error('uninstall failed'))
    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsRemoveCommand(['@community/broken-uninstall'], mockConfig)
    cmd.log = vi.fn()
    cmd.warn = vi.fn()

    await cmd.run()

    // Should still deregister even though uninstall failed
    expect(mockRemoveAgent).toHaveBeenCalledWith('@community/broken-uninstall')
  })
})
