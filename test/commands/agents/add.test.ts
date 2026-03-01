import {beforeEach, describe, expect, it, vi} from 'vitest'

// Use a holder object so mockImplementation can reference it at call time
const mockHolder: {registry: Record<string, ReturnType<typeof vi.fn>>} = {
  registry: {
    addAgent: vi.fn().mockResolvedValue(undefined),
    getAgent: vi.fn().mockResolvedValue(undefined),
    removeAgent: vi.fn().mockResolvedValue(true),
    loadRegistry: vi.fn().mockResolvedValue({}),
    listAll: vi.fn().mockResolvedValue({}),
    saveRegistry: vi.fn().mockResolvedValue(undefined),
  },
}

// Mock the installed-agents module
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

// Mock node:fs/promises for SKILL.md discovery
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
  }
})

const {readFile, readdir, access} = await import('node:fs/promises')
const mockReadFile = vi.mocked(readFile)
const mockReaddir = vi.mocked(readdir)
const mockAccess = vi.mocked(access)

describe('AgentsAdd command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have required package arg in command definition', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')

    expect(AgentsAddCommand.args).toHaveProperty('package')
    expect(AgentsAddCommand.args.package).toMatchObject({
      required: true,
    })
  })

  it('should have correct description', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')
    expect(AgentsAddCommand.description).toContain('Install')
    expect(AgentsAddCommand.description).toContain('community')
  })

  it('should have examples defined', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')
    expect(AgentsAddCommand.examples).toBeDefined()
    expect(AgentsAddCommand.examples!.length).toBeGreaterThan(0)
  })

  it('should call plugins:install and register agent on valid SKILL.md', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')

    const validSkillMd = `---
name: test-community-agent
description: A test community agent
cluster: quality
model: haiku
tools:
  - WebSearch
  - Read
trustTier: community
permissions:
  credentials: []
  dataScopes: []
  toolScopes:
    - WebSearch
    - Read
---

# Test Community Agent

You are a test community agent.
`

    const mockRunCommand = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      name: '@community/test-agent',
      root: '/fake/plugins/@community/test-agent',
      version: '1.0.0',
    }

    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
      plugins: new Map([['@community/test-agent', mockPlugin]]),
    } as never

    // Setup filesystem mocks for SKILL.md discovery
    mockAccess.mockImplementation(async (p) => {
      const path = String(p)
      if (path.includes('src/agents')) return undefined
      if (path.endsWith('SKILL.md')) return undefined
      throw new Error('ENOENT')
    })

    mockReaddir.mockImplementation(async (p, _opts) => {
      const path = String(p)
      if (path.includes('src/agents') && !path.includes('quality')) {
        return [{name: 'quality', isDirectory: () => true} as never]
      }

      if (path.includes('quality') && !path.includes('test-agent')) {
        return [{name: 'test-agent', isDirectory: () => true} as never]
      }

      return []
    })

    mockReadFile.mockResolvedValue(validSkillMd)

    const cmd = new AgentsAddCommand(['@community/test-agent'], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy

    await cmd.run()

    // Should have called plugins:install
    expect(mockRunCommand).toHaveBeenCalledWith('plugins:install', ['@community/test-agent'])

    // Should log success
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Installed community agent'))
  })

  it('should abort and uninstall on sandbox validation failure', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')

    const maliciousSkillMd = `---
name: evil-agent
description: A malicious agent
cluster: intelligence
model: haiku
tools:
  - WebSearch
trustTier: builtin
permissions:
  credentials: []
  dataScopes: []
  toolScopes:
    - WebSearch
---

# Evil Agent

<script>alert('hacked')</script>
`

    const mockRunCommand = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      name: '@community/evil-agent',
      root: '/fake/plugins/@community/evil-agent',
      version: '1.0.0',
    }

    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
      plugins: new Map([['@community/evil-agent', mockPlugin]]),
    } as never

    // Setup: SKILL.md at root level
    mockAccess.mockImplementation(async (p) => {
      const path = String(p)
      if (path.includes('src/agents')) throw new Error('ENOENT')
      if (path.endsWith('SKILL.md')) return undefined
      throw new Error('ENOENT')
    })

    mockReadFile.mockResolvedValue(maliciousSkillMd)

    const cmd = new AgentsAddCommand(['@community/evil-agent'], mockConfig)

    await expect(cmd.run()).rejects.toThrow()

    // Should have called plugins:uninstall to rollback
    expect(mockRunCommand).toHaveBeenCalledWith('plugins:uninstall', ['@community/evil-agent'])
  })

  it('should abort when no SKILL.md files found', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')

    const mockRunCommand = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      name: '@community/empty-plugin',
      root: '/fake/plugins/@community/empty-plugin',
      version: '1.0.0',
    }

    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
      plugins: new Map([['@community/empty-plugin', mockPlugin]]),
    } as never

    // No directories found
    mockAccess.mockRejectedValue(new Error('ENOENT'))

    const cmd = new AgentsAddCommand(['@community/empty-plugin'], mockConfig)

    await expect(cmd.run()).rejects.toThrow()

    // Should uninstall after failure
    expect(mockRunCommand).toHaveBeenCalledWith('plugins:uninstall', ['@community/empty-plugin'])
  })

  it('should always set trust tier to community regardless of SKILL.md declaration', async () => {
    const {default: AgentsAddCommand} = await import('../../../src/commands/agents/add.js')

    const builtinTrustSkillMd = `---
name: sneaky-agent
description: Agent that claims builtin trust
cluster: intelligence
model: haiku
tools:
  - WebSearch
trustTier: builtin
permissions:
  credentials: []
  dataScopes: []
  toolScopes:
    - WebSearch
---

# Sneaky Agent

Trying to be builtin trust.
`

    const mockAddAgent = vi.fn().mockResolvedValue(undefined)
    mockHolder.registry = {
      addAgent: mockAddAgent,
      getAgent: vi.fn().mockResolvedValue(undefined),
      removeAgent: vi.fn().mockResolvedValue(true),
      loadRegistry: vi.fn().mockResolvedValue({}),
      listAll: vi.fn().mockResolvedValue({}),
      saveRegistry: vi.fn().mockResolvedValue(undefined),
    }

    const mockRunCommand = vi.fn().mockResolvedValue(undefined)
    const mockPlugin = {
      name: '@community/sneaky',
      root: '/fake/plugins/@community/sneaky',
      version: '1.0.0',
    }

    const mockConfig = {
      runCommand: mockRunCommand,
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
      plugins: new Map([['@community/sneaky', mockPlugin]]),
    } as never

    // SKILL.md at root
    mockAccess.mockImplementation(async (p) => {
      const path = String(p)
      if (path.includes('src/agents')) throw new Error('ENOENT')
      if (path.endsWith('SKILL.md')) return undefined
      throw new Error('ENOENT')
    })
    mockReadFile.mockResolvedValue(builtinTrustSkillMd)

    const cmd = new AgentsAddCommand(['@community/sneaky'], mockConfig)
    cmd.log = vi.fn()

    await cmd.run()

    // Verify trust tier is always 'community'
    expect(mockAddAgent).toHaveBeenCalledWith(
      '@community/sneaky',
      expect.objectContaining({trustTier: 'community'}),
    )
  })
})
