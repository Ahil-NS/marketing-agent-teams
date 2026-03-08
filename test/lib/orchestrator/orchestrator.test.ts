import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {createMockAgentResult} from '../../helpers/mock-agent-executor.js'

// Mock executeAgent so StageRunner doesn't call real agent infrastructure
vi.mock('../../../src/lib/agents/agent-executor.js', () => ({
  executeAgent: vi.fn(),
}))

vi.mock('../../../src/lib/agents/errors.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/agents/errors.js')>()
  return actual
})

import {executeAgent} from '../../../src/lib/agents/agent-executor.js'
import {AllAgentsFailedError, PipelineExecutionError} from '../../../src/lib/orchestrator/errors.js'
import {Orchestrator} from '../../../src/lib/orchestrator/orchestrator.js'
import {savePipelineRun} from '../../../src/lib/orchestrator/state-serializer.js'
import {StageRunner} from '../../../src/lib/orchestrator/stage-runner.js'
import {createTestPipelineRun} from '../../helpers/pipeline-state-factory.js'

const mockExecuteAgent = vi.mocked(executeAgent)

function makeConfig(overrides?: Partial<import('../../../src/lib/orchestrator/types.js').OrchestratorConfig>) {
  return {
    platforms: ['reddit'],
    dryRun: false,
    budgetLimit: 10,
    disabledAgents: [] as string[],
    projectRoot: '', // Set in beforeEach
    postsPerPlatform: 3, // Use full agent set by default in tests
    ...overrides,
  }
}

describe('Orchestrator', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-orch-test-'))
    vi.useFakeTimers()
    mockExecuteAgent.mockReset()
  })

  afterEach(async () => {
    vi.useRealTimers()
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('create()', () => {
    it('creates a new Orchestrator with a fresh pipeline run', async () => {
      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      expect(orchestrator.getRunId()).toBeDefined()
      expect(orchestrator.getState().status).toBe('running')
      expect(orchestrator.getState().currentStage).toBe('research')
    })
  })

  describe('execute() — full pipeline success', () => {
    it('executes all stages and completes pipeline when all agents succeed', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 100, outputTokens: 50, cost: 0.001}}),
      )

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const resultPromise = orchestrator.execute()
      // Advance timers to resolve agent timeout promises
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      // Pipeline should pause at review (not complete through to distribution)
      expect(result.status).toBe('paused')
      expect(result.currentStage).toBe('review')
    })
  })

  describe('execute() — degraded mode (partial failure)', () => {
    it('continues pipeline when some agents fail in a stage', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        // Fail one agent in research
        if (agentName === 'competitor-analyst') throw new Error('Network timeout')
        return createMockAgentResult(agentName, {usage: {inputTokens: 100, outputTokens: 50, cost: 0.001}})
      })

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      // Pipeline should still reach review (paused)
      expect(result.status).toBe('paused')
      expect(result.currentStage).toBe('review')
    })
  })

  describe('execute() — all agents failed', () => {
    it('throws AllAgentsFailedError and marks pipeline as failed', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        throw new Error(`${agentName} crashed`)
      })

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const executePromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)

      await expect(executePromise).rejects.toThrow(AllAgentsFailedError)

      const state = orchestrator.getState()
      expect(state.status).toBe('failed')
      expect(state.currentStage).toBe('research')
    })
  })

  describe('execute() — review pause', () => {
    it('pauses pipeline at review stage', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('paused')
      expect(result.currentStage).toBe('review')
      // Stages up to quality should be completed
      expect(result.stages.research.status).toBe('completed')
      expect(result.stages.strategy.status).toBe('completed')
      expect(result.stages.creation.status).toBe('completed')
      expect(result.stages.optimization.status).toBe('completed')
      expect(result.stages.quality.status).toBe('completed')
      expect(result.stages.review.status).toBe('paused')
      expect(result.stages.distribution.status).toBe('pending')
    })
  })

  describe('execute() — resume from review', () => {
    it('resumes pipeline from review and completes through distribution', async () => {
      // Set up a paused-at-review pipeline state
      const pausedState = createTestPipelineRun({
        status: 'paused',
        currentStage: 'review',
      })
      pausedState.stages.research.status = 'completed'
      pausedState.stages.research.agentResults = {
        'trend-scout': {
          agentName: 'trend-scout',
          status: 'success',
          result: createMockAgentResult('trend-scout'),
          error: null,
          duration: 1000,
        },
      }
      pausedState.stages.strategy.status = 'completed'
      pausedState.stages.strategy.agentResults = {}
      pausedState.stages.creation.status = 'completed'
      pausedState.stages.creation.agentResults = {}
      pausedState.stages.optimization.status = 'completed'
      pausedState.stages.optimization.agentResults = {}
      pausedState.stages.quality.status = 'completed'
      pausedState.stages.quality.agentResults = {}
      pausedState.stages.review.status = 'paused'
      await savePipelineRun(pausedState, tmpDir)

      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.resume(pausedState.id, config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('completed')
      expect(result.stages.distribution.status).toBe('completed')
    })
  })

  describe('execute() — disabled agents', () => {
    it('filters out disabled agents from execution', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      // Disable all research agents except trend-scout
      const config = makeConfig({
        projectRoot: tmpDir,
        disabledAgents: ['audience-researcher', 'competitor-analyst'],
      })
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('paused')
      // Verify trend-scout ran (check that executeAgent was called with it)
      const executedAgents = mockExecuteAgent.mock.calls.map(([name]) => name)
      expect(executedAgents).toContain('trend-scout')
      expect(executedAgents).not.toContain('audience-researcher')
      expect(executedAgents).not.toContain('competitor-analyst')
    })
  })

  describe('execute() — budget exceeded', () => {
    it('throws PipelineExecutionError when budget limit is exceeded', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 1000, outputTokens: 500, cost: 5.0}}),
      )

      // Set very low budget
      const config = makeConfig({projectRoot: tmpDir, budgetLimit: 1})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const executePromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)

      await expect(executePromise).rejects.toThrow(PipelineExecutionError)
      expect(orchestrator.getState().status).toBe('failed')
    })
  })

  describe('execute() — dry-run mode', () => {
    it('skips distribution stage in dry-run mode', async () => {
      // Set up a paused-at-review state to resume past review into distribution
      const pausedState = createTestPipelineRun({
        status: 'paused',
        currentStage: 'review',
      })
      pausedState.stages.research.status = 'completed'
      pausedState.stages.strategy.status = 'completed'
      pausedState.stages.creation.status = 'completed'
      pausedState.stages.optimization.status = 'completed'
      pausedState.stages.quality.status = 'completed'
      pausedState.stages.review.status = 'paused'
      await savePipelineRun(pausedState, tmpDir)

      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName),
      )

      const config = makeConfig({projectRoot: tmpDir, dryRun: true})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.resume(pausedState.id, config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      // Pipeline should complete without running distribution agents
      expect(result.status).toBe('completed')
      // Distribution agents should NOT have been called
      const executedAgents = mockExecuteAgent.mock.calls.map(([name]) => name)
      expect(executedAgents).not.toContain('reddit-publisher')
      expect(executedAgents).not.toContain('tiktok-publisher')
    })
  })

  describe('execute() — empty stage (all agents disabled)', () => {
    it('skips stage when all agents are disabled', async () => {
      // Disable all research agents
      const config = makeConfig({
        projectRoot: tmpDir,
        disabledAgents: ['trend-scout', 'audience-researcher', 'competitor-analyst'],
      })

      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      // Research should be skipped (skipped status via StageRunner)
      // Pipeline should still reach review pause
      expect(result.status).toBe('paused')
      // Verify disabled agents were NOT executed
      const executedAgents = mockExecuteAgent.mock.calls.map(([name]) => name)
      expect(executedAgents).not.toContain('trend-scout')
      expect(executedAgents).not.toContain('audience-researcher')
      expect(executedAgents).not.toContain('competitor-analyst')
    })
  })

  describe('execute() — events', () => {
    it('calls onStageStart and onStageComplete events', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      const events = {
        onStageStart: vi.fn(),
        onStageComplete: vi.fn(),
        onPipelinePaused: vi.fn(),
      }

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner, events)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      await resultPromise

      // Should have start/complete events for research, strategy, creation, optimization, quality
      expect(events.onStageStart).toHaveBeenCalledTimes(5)
      expect(events.onStageComplete).toHaveBeenCalledTimes(5)
      expect(events.onPipelinePaused).toHaveBeenCalledWith('review')
    })

    it('calls onAgentFailed for failed agents in degraded mode', async () => {
      mockExecuteAgent.mockImplementation(async (agentName: string) => {
        if (agentName === 'competitor-analyst') throw new Error('Network timeout')
        return createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}})
      })

      const events = {
        onStageStart: vi.fn(),
        onStageComplete: vi.fn(),
        onPipelinePaused: vi.fn(),
        onAgentFailed: vi.fn(),
      }

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner, events)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      await resultPromise

      expect(events.onAgentFailed).toHaveBeenCalled()
      const failedAgentNames = events.onAgentFailed.mock.calls.map((call) => call[0] as string)
      expect(failedAgentNames).toContain('competitor-analyst')
    })
  })

  describe('execute() — resume from failed', () => {
    it('resumes a failed pipeline from the failed stage', async () => {
      // Create a failed state at research
      const failedState = createTestPipelineRun({
        status: 'failed',
        currentStage: 'research',
      })
      failedState.stages.research.status = 'failed'
      failedState.stages.research.error = {
        stage: 'research',
        code: 'STAGE_ALL_AGENTS_FAILED',
        message: 'All agents failed',
        reason: 'Test',
        resolution: 'Retry',
        severity: 'permanent',
        timestamp: '2026-02-28T10:00:00.000Z',
      }
      await savePipelineRun(failedState, tmpDir)

      // Now agents will succeed
      mockExecuteAgent.mockImplementation(async (agentName: string) =>
        createMockAgentResult(agentName, {usage: {inputTokens: 10, outputTokens: 5, cost: 0.0001}}),
      )

      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.resume(failedState.id, config, stageRunner)

      const resultPromise = orchestrator.execute()
      await vi.advanceTimersByTimeAsync(0)
      const result = await resultPromise

      expect(result.status).toBe('paused')
      expect(result.currentStage).toBe('review')
      expect(result.stages.research.status).toBe('completed')
    })
  })

  describe('getRunId()', () => {
    it('returns the pipeline run ID', async () => {
      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/
      expect(orchestrator.getRunId()).toMatch(uuidRegex)
    })
  })

  describe('getState()', () => {
    it('returns current pipeline state', async () => {
      const config = makeConfig({projectRoot: tmpDir})
      const stageRunner = new StageRunner()
      const orchestrator = await Orchestrator.create(config, stageRunner)

      const state = orchestrator.getState()
      expect(state.id).toBe(orchestrator.getRunId())
      expect(state.status).toBe('running')
      expect(state.config.platforms).toEqual(['reddit'])
    })
  })
})
