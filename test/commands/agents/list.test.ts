import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {SkillDefinition} from '../../../src/lib/agents/types.js'

// Mock skill-loader
vi.mock('../../../src/lib/agents/skill-loader.js', () => ({
  loadAllSkills: vi.fn(),
}))

// Use a holder object so mockImplementation can reference it at call time
const mockHolder: {registry: Record<string, ReturnType<typeof vi.fn>>} = {
  registry: {
    listAll: vi.fn().mockResolvedValue({}),
    addAgent: vi.fn(),
    removeAgent: vi.fn(),
    getAgent: vi.fn(),
    loadRegistry: vi.fn(),
    saveRegistry: vi.fn(),
  },
}

// Mock installed-agents — the factory accesses mockHolder at call time (not hoist time)
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

const {loadAllSkills} = await import('../../../src/lib/agents/skill-loader.js')
const mockLoadAllSkills = vi.mocked(loadAllSkills)

function createMockSkill(overrides?: Partial<SkillDefinition>): SkillDefinition {
  return {
    name: 'test-agent',
    description: 'A test agent',
    cluster: 'intelligence',
    model: 'haiku',
    tools: ['WebSearch'],
    trustTier: 'builtin',
    schemaVersion: '1.0.0',
    systemPrompt: 'You are a test agent',
    knowledgeContext: '',
    templates: {},
    ...overrides,
  }
}

describe('AgentsList command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct description', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')
    expect(AgentsListCommand.description).toContain('List')
  })

  it('should enable JSON flag', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')
    expect(AgentsListCommand.enableJsonFlag).toBe(true)
  })

  it('should have format flag defined', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')
    expect(AgentsListCommand.flags).toHaveProperty('format')
  })

  it('should list builtin agents from loadAllSkills', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    const skills = new Map<string, SkillDefinition>()
    skills.set('trend-scout', createMockSkill({name: 'trend-scout', cluster: 'intelligence'}))
    skills.set('seo-optimizer', createMockSkill({name: 'seo-optimizer', cluster: 'optimization'}))
    mockLoadAllSkills.mockResolvedValue(skills)

    mockHolder.registry.listAll.mockResolvedValue({})

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: false, format: 'table'}, args: {}})

    await cmd.run()

    // Should display agent names
    const output = logSpy.mock.calls.map((c: string[]) => c[0]).join('\n')
    expect(output).toContain('trend-scout')
    expect(output).toContain('seo-optimizer')
    expect(output).toContain('builtin')
  })

  it('should list community agents from registry', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    mockLoadAllSkills.mockRejectedValue(new Error('no src/agents'))

    mockHolder.registry.listAll.mockResolvedValue({
      '@community/sentiment': {
        package: '@community/sentiment',
        version: '1.0.0',
        installedAt: '2026-03-01T00:00:00Z',
        trustTier: 'community',
        agents: ['sentiment-analyzer'],
        enabled: true,
      },
    })

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: false, format: 'table'}, args: {}})

    await cmd.run()

    const output = logSpy.mock.calls.map((c: string[]) => c[0]).join('\n')
    expect(output).toContain('sentiment-analyzer')
    expect(output).toContain('community')
  })

  it('should show both builtin and community agents together', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    const skills = new Map<string, SkillDefinition>()
    skills.set('trend-scout', createMockSkill({name: 'trend-scout', cluster: 'intelligence'}))
    mockLoadAllSkills.mockResolvedValue(skills)

    mockHolder.registry.listAll.mockResolvedValue({
      '@community/custom': {
        package: '@community/custom',
        version: '2.0.0',
        installedAt: '2026-03-01T00:00:00Z',
        trustTier: 'community',
        agents: ['custom-agent'],
        enabled: false,
      },
    })

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: false, format: 'table'}, args: {}})

    await cmd.run()

    const output = logSpy.mock.calls.map((c: string[]) => c[0]).join('\n')
    expect(output).toContain('trend-scout')
    expect(output).toContain('builtin')
    expect(output).toContain('custom-agent')
    expect(output).toContain('community')
    expect(output).toContain('2 agent(s) total')
  })

  it('should return JSON format when --json flag is set', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    const skills = new Map<string, SkillDefinition>()
    skills.set('trend-scout', createMockSkill({name: 'trend-scout'}))
    mockLoadAllSkills.mockResolvedValue(skills)

    mockHolder.registry.listAll.mockResolvedValue({})

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: true, format: 'table'}, args: {}})

    const result = await cmd.run()
    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).agents).toBeDefined()
    expect((result as Record<string, unknown>).total).toBe(1)
  })

  it('should display disabled agents with "no" in enabled column', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    mockLoadAllSkills.mockRejectedValue(new Error('no agents'))

    mockHolder.registry.listAll.mockResolvedValue({
      '@community/disabled': {
        package: '@community/disabled',
        version: '1.0.0',
        installedAt: '2026-03-01T00:00:00Z',
        trustTier: 'community',
        agents: ['disabled-agent'],
        enabled: false,
      },
    })

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: false, format: 'table'}, args: {}})

    await cmd.run()

    const output = logSpy.mock.calls.map((c: string[]) => c[0]).join('\n')
    expect(output).toContain('no')
  })

  it('should show "No agents found" when both sources are empty', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    mockLoadAllSkills.mockResolvedValue(new Map())

    mockHolder.registry.listAll.mockResolvedValue({})

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    const logSpy = vi.fn()
    cmd.log = logSpy
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: false, format: 'table'}, args: {}})

    await cmd.run()

    const output = logSpy.mock.calls.map((c: string[]) => c[0]).join('\n')
    expect(output).toContain('No agents found')
  })

  it('should sort agents by cluster then name', async () => {
    const {default: AgentsListCommand} = await import('../../../src/commands/agents/list.js')

    const skills = new Map<string, SkillDefinition>()
    skills.set('seo-optimizer', createMockSkill({name: 'seo-optimizer', cluster: 'optimization'}))
    skills.set('trend-scout', createMockSkill({name: 'trend-scout', cluster: 'intelligence'}))
    skills.set('competitor-analyst', createMockSkill({name: 'competitor-analyst', cluster: 'intelligence'}))
    mockLoadAllSkills.mockResolvedValue(skills)

    mockHolder.registry.listAll.mockResolvedValue({})

    const mockConfig = {
      runHook: vi.fn().mockResolvedValue({successes: [], failures: []}),
    } as never

    const cmd = new AgentsListCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({flags: {json: true, format: 'table'}, args: {}})

    const result = await cmd.run() as Record<string, unknown>
    const agents = (result as {agents: Array<{name: string; cluster: string}>}).agents

    // Intelligence should come before optimization (alphabetical)
    const intelligenceIdx = agents.findIndex((a) => a.cluster === 'intelligence')
    const optimizationIdx = agents.findIndex((a) => a.cluster === 'optimization')
    expect(intelligenceIdx).toBeLessThan(optimizationIdx)

    // Within intelligence: competitor-analyst before trend-scout
    const competitorIdx = agents.findIndex((a) => a.name === 'competitor-analyst')
    const trendIdx = agents.findIndex((a) => a.name === 'trend-scout')
    expect(competitorIdx).toBeLessThan(trendIdx)
  })
})
