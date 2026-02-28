import {beforeEach, describe, expect, it, vi} from 'vitest'

import {AgentNotFoundError, AgentTestError} from '../../../src/lib/agent-testing/errors.js'
import type {AgentTestResult} from '../../../src/lib/agent-testing/types.js'

// Mock the agent-testing module — keep real error classes, mock functions
vi.mock('../../../src/lib/agent-testing/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/agent-testing/index.js')>()
  return {
    ...actual,
    runAgentTest: vi.fn(),
    formatTestResult: vi.fn(),
  }
})

const {runAgentTest, formatTestResult} = await import('../../../src/lib/agent-testing/index.js')
const mockRunAgentTest = vi.mocked(runAgentTest)
const mockFormatTestResult = vi.mocked(formatTestResult)
const mockConfig = {runHook: vi.fn().mockResolvedValue({successes: [], failures: []})} as never

function createTestResult(overrides?: Partial<AgentTestResult>): AgentTestResult {
  return {
    agentName: 'trend-scout',
    cluster: 'intelligence',
    status: 'success',
    content: 'Generated content',
    outputs: {data: 'test'},
    usage: {inputTokens: 100, outputTokens: 50, totalTokens: 150, cost: 0.001},
    duration: 2000,
    model: 'haiku',
    turns: 0,
    errors: [],
    ...overrides,
  }
}

describe('AgentsTest command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have required name arg in command definition', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')

    expect(AgentsTestCommand.args).toHaveProperty('name')
    expect(AgentsTestCommand.args.name).toMatchObject({
      required: true,
    })
  })

  it('should have expected flags defined', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')

    expect(AgentsTestCommand.flags).toHaveProperty('input')
    expect(AgentsTestCommand.flags).toHaveProperty('model')
    expect(AgentsTestCommand.flags).toHaveProperty('max-turns')
  })

  it('should have correct description', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')

    expect(AgentsTestCommand.description).toBe('Test an agent in isolation outside the pipeline')
  })

  it('should enable JSON flag', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')

    expect(AgentsTestCommand.enableJsonFlag).toBe(true)
  })

  it('should delegate to runAgentTest and formatTestResult on run()', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')
    const result = createTestResult()
    mockRunAgentTest.mockResolvedValue(result)
    mockFormatTestResult.mockReturnValue('formatted output')

    const cmd = new AgentsTestCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {input: undefined, model: undefined, 'max-turns': undefined, json: false},
      args: {name: 'trend-scout'},
      argv: [], raw: [], metadata: {}, nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockRunAgentTest).toHaveBeenCalledWith('trend-scout', {
      inputPath: undefined, json: false, maxTurns: undefined, model: undefined,
    })
    expect(mockFormatTestResult).toHaveBeenCalledWith(result, false)
    expect(cmd.log).toHaveBeenCalledWith('formatted output')
  })

  it('should pass --input flag to runAgentTest', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')
    mockRunAgentTest.mockResolvedValue(createTestResult())
    mockFormatTestResult.mockReturnValue('output')

    const cmd = new AgentsTestCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {input: './test-inputs.json', model: undefined, 'max-turns': undefined, json: false},
      args: {name: 'trend-scout'},
      argv: [], raw: [], metadata: {}, nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockRunAgentTest).toHaveBeenCalledWith('trend-scout', expect.objectContaining({
      inputPath: './test-inputs.json',
    }))
  })

  it('should pass --model flag to runAgentTest', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')
    mockRunAgentTest.mockResolvedValue(createTestResult())
    mockFormatTestResult.mockReturnValue('output')

    const cmd = new AgentsTestCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {input: undefined, model: 'sonnet', 'max-turns': undefined, json: false},
      args: {name: 'trend-scout'},
      argv: [], raw: [], metadata: {}, nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockRunAgentTest).toHaveBeenCalledWith('trend-scout', expect.objectContaining({
      model: 'sonnet',
    }))
  })

  it('should return result object when --json flag is used', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')
    const testResult = createTestResult()
    mockRunAgentTest.mockResolvedValue(testResult)

    const cmd = new AgentsTestCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {input: undefined, model: undefined, 'max-turns': undefined, json: true},
      args: {name: 'trend-scout'},
      argv: [], raw: [], metadata: {}, nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toBeDefined()
    expect(mockFormatTestResult).not.toHaveBeenCalled()
  })

  it('should display MATError with reason and resolution on failure', async () => {
    const {default: AgentsTestCommand} = await import('../../../src/commands/agents/test.js')
    mockRunAgentTest.mockRejectedValue(new AgentNotFoundError('missing-agent'))

    const cmd = new AgentsTestCommand([], mockConfig)
    cmd.log = vi.fn()
    cmd.error = vi.fn(() => { throw new Error('exit') }) as never
    cmd.parse = vi.fn().mockResolvedValue({
      flags: {input: undefined, model: undefined, 'max-turns': undefined, json: false},
      args: {name: 'missing-agent'},
      argv: [], raw: [], metadata: {}, nonExistentFlags: {},
    })

    await expect(cmd.run()).rejects.toThrow('exit')

    expect(cmd.error).toHaveBeenCalledWith(
      expect.stringContaining('Reason:'),
      expect.objectContaining({code: 'AGENT_NOT_FOUND', exit: 1}),
    )
  })

  it('should export error classes', async () => {
    const agentTesting = await import('../../../src/lib/agent-testing/index.js')

    expect(agentTesting.AgentNotFoundError).toBe(AgentNotFoundError)
    expect(agentTesting.AgentTestError).toBe(AgentTestError)
  })
})
