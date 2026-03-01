import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {AgentTestOptions} from '../../../src/lib/agent-testing/types.js'
import {AgentNotFoundError, AgentTestError} from '../../../src/lib/agent-testing/errors.js'
import type {AgentResult, SkillDefinition} from '../../../src/lib/agents/types.js'
import {AgentExecutionError} from '../../../src/lib/agents/errors.js'

// Mock skill-loader
vi.mock('../../../src/lib/agents/skill-loader.js', () => ({
  loadSkill: vi.fn(),
  resolveAgentDir: vi.fn().mockResolvedValue('/mock/agents/intelligence/trend-scout'),
}))

// Mock agent-executor
vi.mock('../../../src/lib/agents/agent-executor.js', () => ({
  executeAgent: vi.fn(),
}))

// Import mocks after vi.mock declarations
const {loadSkill} = await import('../../../src/lib/agents/skill-loader.js')
const {executeAgent} = await import('../../../src/lib/agents/agent-executor.js')
const {runAgentTest} = await import('../../../src/lib/agent-testing/agent-test-runner.js')

const mockLoadSkill = vi.mocked(loadSkill)
const mockExecuteAgent = vi.mocked(executeAgent)

function createSkillDef(overrides?: Partial<SkillDefinition>): SkillDefinition {
  return {
    name: 'trend-scout',
    description: 'Discovers marketing trends',
    cluster: 'intelligence',
    model: 'haiku',
    tools: ['WebSearch'],
    trustTier: 'builtin',
    permissions: {credentials: [], dataScopes: [], toolScopes: []},
    systemPrompt: 'You are a trend scout agent.',
    knowledgeContext: '',
    templates: {},
    ...overrides,
  }
}

function createAgentResult(overrides?: Partial<AgentResult>): AgentResult {
  return {
    agentName: 'trend-scout',
    runId: 'test-run-001',
    status: 'success',
    outputs: {trends: ['AI tools'], patterns: ['short-form video']},
    usage: {inputTokens: 450, outputTokens: 380, cost: 0.0025},
    duration: 4500,
    errors: [],
    ...overrides,
  }
}

describe('runAgentTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute agent and return AgentTestResult on success', async () => {
    const skillDef = createSkillDef()
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    const result = await runAgentTest('trend-scout', {})

    expect(result.agentName).toBe('trend-scout')
    expect(result.cluster).toBe('intelligence')
    expect(result.status).toBe('success')
    expect(result.model).toBe('haiku')
    expect(result.usage.inputTokens).toBe(450)
    expect(result.usage.outputTokens).toBe(380)
    expect(result.usage.totalTokens).toBe(830)
    expect(result.usage.cost).toBe(0.0025)
    expect(result.duration).toBeGreaterThanOrEqual(0)
    expect(result.errors).toEqual([])
  })

  it('should throw AgentNotFoundError when agent does not exist', async () => {
    mockLoadSkill.mockRejectedValue(new Error('Not found'))

    await expect(runAgentTest('nonexistent-agent', {})).rejects.toThrow(AgentNotFoundError)
  })

  it('should throw AgentTestError when agent execution fails', async () => {
    const skillDef = createSkillDef()
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockRejectedValue(
      new AgentExecutionError('trend-scout', 'AGENT_EXECUTION_FAILED', 'SDK error'),
    )

    await expect(runAgentTest('trend-scout', {})).rejects.toThrow(AgentTestError)
  })

  it('should use model override from options', async () => {
    const skillDef = createSkillDef({model: 'haiku'})
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    const options: AgentTestOptions = {model: 'sonnet'}
    const result = await runAgentTest('trend-scout', options)

    expect(result.model).toBe('sonnet')
    expect(mockExecuteAgent).toHaveBeenCalledWith(
      'trend-scout',
      expect.objectContaining({model: 'sonnet'}),
    )
  })

  it('should use maxTurns override from options', async () => {
    const skillDef = createSkillDef()
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    const options: AgentTestOptions = {maxTurns: 5}
    await runAgentTest('trend-scout', options)

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      'trend-scout',
      expect.objectContaining({maxTurns: 5}),
    )
  })

  it('should pass allowed tools from skill definition', async () => {
    const skillDef = createSkillDef({tools: ['WebSearch', 'WebFetch']})
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    await runAgentTest('trend-scout', {})

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      'trend-scout',
      expect.objectContaining({allowedTools: ['WebSearch', 'WebFetch']}),
    )
  })

  it('should capture usage metrics from AgentResult', async () => {
    const skillDef = createSkillDef()
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(
      createAgentResult({
        usage: {inputTokens: 1000, outputTokens: 500, cost: 0.005},
      }),
    )

    const result = await runAgentTest('trend-scout', {})

    expect(result.usage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      cost: 0.005,
    })
  })

  it('should serialize object outputs as content string', async () => {
    const skillDef = createSkillDef()
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(
      createAgentResult({outputs: {trends: ['AI', 'ML']}}),
    )

    const result = await runAgentTest('trend-scout', {})

    expect(result.content).toContain('trends')
    expect(result.content).toContain('AI')
    const parsed = JSON.parse(result.content)
    expect(parsed.trends).toEqual(['AI', 'ML'])
  })

  it('should use cluster defaults when no examples or input file', async () => {
    const skillDef = createSkillDef({cluster: 'intelligence'})
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    await runAgentTest('trend-scout', {})

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      'trend-scout',
      expect.objectContaining({
        prompt: expect.stringContaining('brandName'),
      }),
    )
  })

  it('should build prompt with test inputs', async () => {
    const skillDef = createSkillDef({
      examples: [{description: 'Test', inputs: {brandName: 'MyBrand'}}],
    })
    mockLoadSkill.mockResolvedValue(skillDef)
    mockExecuteAgent.mockResolvedValue(createAgentResult())

    await runAgentTest('trend-scout', {})

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      'trend-scout',
      expect.objectContaining({
        prompt: expect.stringContaining('MyBrand'),
      }),
    )
  })
})
