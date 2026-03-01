import {execSync} from 'node:child_process'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {PipelineStage, StageExecutionResult} from '../../../src/lib/orchestrator/types.js'
import {PIPELINE_STAGES, STAGE_AGENT_MAP} from '../../../src/lib/orchestrator/types.js'
import {
  StageOutputRouter,
  TmuxPaneRoutingError,
  TMUX_PANE_ROUTING_ERROR,
  createLayout,
  getPaneId,
  markComplete,
  markFailed,
  printSeparator,
  routeOutput,
} from '../../../src/lib/tmux/pane-layout.js'
import type {PaneLayout} from '../../../src/lib/tmux/pane-layout.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)

const SESSION_NAME = 'mat-550e8400-e29b-41d4-a716-446655440000'

describe('PaneLayout', () => {
  let layout: PaneLayout

  beforeEach(() => {
    layout = createLayout(SESSION_NAME)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==================================================================
  // Task 6.1: Test pane layout creation
  // ==================================================================
  describe('createLayout()', () => {
    it('creates a layout mapping all pipeline stages to pane indices', () => {
      expect(layout.sessionName).toBe(SESSION_NAME)
      expect(Object.keys(layout.paneMap)).toHaveLength(PIPELINE_STAGES.length)

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        expect(layout.paneMap[PIPELINE_STAGES[i]]).toBe(i)
      }
    })

    it('maps research to pane 0', () => {
      expect(layout.paneMap.research).toBe(0)
    })

    it('maps distribution to the last pane', () => {
      expect(layout.paneMap.distribution).toBe(PIPELINE_STAGES.length - 1)
    })
  })

  describe('getPaneId()', () => {
    it('returns correct pane target string for research stage', () => {
      expect(getPaneId(layout, 'research')).toBe(`${SESSION_NAME}:0.0`)
    })

    it('returns correct pane target string for distribution stage', () => {
      const lastIndex = PIPELINE_STAGES.length - 1
      expect(getPaneId(layout, 'distribution')).toBe(`${SESSION_NAME}:0.${lastIndex}`)
    })

    it('returns correct format for all stages', () => {
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const stage = PIPELINE_STAGES[i]
        expect(getPaneId(layout, stage)).toBe(`${SESSION_NAME}:0.${i}`)
      }
    })
  })

  // ==================================================================
  // Task 6.2: Test output routing to correct panes
  // ==================================================================
  describe('routeOutput()', () => {
    it('sends content to the correct pane via tmux send-keys', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      routeOutput(layout, 'research', 'Hello world')

      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux send-keys -t ${SESSION_NAME}:0.0 'Hello world' Enter`,
        {stdio: 'pipe'},
      )
    })

    it('routes to correct pane for strategy stage', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      routeOutput(layout, 'strategy', 'Strategy output')

      const strategyIndex = PIPELINE_STAGES.indexOf('strategy')
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux send-keys -t ${SESSION_NAME}:0.${strategyIndex} 'Strategy output' Enter`,
        {stdio: 'pipe'},
      )
    })

    it('escapes single quotes in content', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      routeOutput(layout, 'research', "it's a test")

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("'it'\\''s a test'"),
        {stdio: 'pipe'},
      )
    })

    it('throws TmuxPaneRoutingError when send-keys fails', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('pane not found')
      })

      expect(() => routeOutput(layout, 'research', 'test'))
        .toThrow(TmuxPaneRoutingError)
    })

    it('TmuxPaneRoutingError has correct error code', () => {
      const error = new TmuxPaneRoutingError('test', 'reason')
      expect(error.code).toBe(TMUX_PANE_ROUTING_ERROR)
      expect(error.severity).toBe('transient')
      expect(error.source).toBe('PaneLayout')
    })
  })

  // ==================================================================
  // Task 6.3: Test separator formatting with agent name and timestamp
  // ==================================================================
  describe('printSeparator()', () => {
    it('prints separator with agent name and timestamp', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      const now = new Date('2026-03-01T10:30:00.000Z')
      vi.setSystemTime(now)

      printSeparator(layout, 'research', 'trend-scout')

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('═══════════════════════════════════════'),
        {stdio: 'pipe'},
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('▶ trend-scout | 2026-03-01T10:30:00.000Z'),
        {stdio: 'pipe'},
      )

      vi.useRealTimers()
    })

    it('routes separator to the correct pane', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      printSeparator(layout, 'creation', 'hook-writer')

      const creationIndex = PIPELINE_STAGES.indexOf('creation')
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(`${SESSION_NAME}:0.${creationIndex}`),
        {stdio: 'pipe'},
      )
    })
  })

  // ==================================================================
  // Task 6.4: Test completion/failure status indicators
  // ==================================================================
  describe('markComplete()', () => {
    it('prints green checkmark with elapsed time in seconds', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      markComplete(layout, 'research', 12300)

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('✓ Stage completed (12.3s)'),
        {stdio: 'pipe'},
      )
    })

    it('formats sub-second elapsed time correctly', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      markComplete(layout, 'research', 500)

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('0.5s'),
        {stdio: 'pipe'},
      )
    })

    it('routes to the correct pane for the stage', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      markComplete(layout, 'quality', 5000)

      const qualityIndex = PIPELINE_STAGES.indexOf('quality')
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(`${SESSION_NAME}:0.${qualityIndex}`),
        {stdio: 'pipe'},
      )
    })
  })

  describe('markFailed()', () => {
    it('prints red X with error summary', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      markFailed(layout, 'research', 'API timeout')

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('✗ Stage failed: API timeout'),
        {stdio: 'pipe'},
      )
    })

    it('routes to the correct pane for the stage', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      markFailed(layout, 'optimization', 'Budget exceeded')

      const optIndex = PIPELINE_STAGES.indexOf('optimization')
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining(`${SESSION_NAME}:0.${optIndex}`),
        {stdio: 'pipe'},
      )
    })
  })

  // ==================================================================
  // StageOutputRouter
  // ==================================================================
  describe('StageOutputRouter', () => {
    let router: StageOutputRouter

    beforeEach(() => {
      router = new StageOutputRouter(layout)
    })

    it('exposes the underlying layout', () => {
      expect(router.getLayout()).toBe(layout)
    })

    describe('write()', () => {
      it('delegates to routeOutput', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.write('research', 'test content')

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`${SESSION_NAME}:0.0`),
          {stdio: 'pipe'},
        )
      })
    })

    describe('separator()', () => {
      it('delegates to printSeparator', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.separator('research', 'trend-scout')

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('▶ trend-scout'),
          {stdio: 'pipe'},
        )
      })
    })

    describe('complete()', () => {
      it('delegates to markComplete', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.complete('research', 10000)

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('10.0s'),
          {stdio: 'pipe'},
        )
      })
    })

    describe('fail()', () => {
      it('delegates to markFailed', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.fail('research', 'timeout')

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('Stage failed: timeout'),
          {stdio: 'pipe'},
        )
      })
    })

    describe('stageHeader()', () => {
      it('prints stage name and agent list', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.stageHeader('research')

        const expectedAgents = STAGE_AGENT_MAP.research.join(', ')
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`Stage: research | Agents: ${expectedAgents}`),
          {stdio: 'pipe'},
        )
      })

      it('shows "(human review)" for review stage with no agents', () => {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))

        router.stageHeader('review')

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('(human review)'),
          {stdio: 'pipe'},
        )
      })
    })

    // ==================================================================
    // buildEvents() — orchestrator integration
    // ==================================================================
    describe('buildEvents()', () => {
      it('returns onStageStart, onStageComplete, onAgentFailed callbacks', () => {
        const events = router.buildEvents()

        expect(events.onStageStart).toBeTypeOf('function')
        expect(events.onStageComplete).toBeTypeOf('function')
        expect(events.onAgentFailed).toBeTypeOf('function')
      })

      describe('onStageStart', () => {
        it('prints stage header in the correct pane', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          events.onStageStart('strategy')

          const strategyIndex = PIPELINE_STAGES.indexOf('strategy')
          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining(`${SESSION_NAME}:0.${strategyIndex}`),
            {stdio: 'pipe'},
          )
        })
      })

      describe('onStageComplete', () => {
        it('marks stage complete on success', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          const result: StageExecutionResult = {
            stage: 'research',
            status: 'completed',
            agentResults: {},
            startedAt: '2026-03-01T10:00:00.000Z',
            completedAt: '2026-03-01T10:00:12.300Z',
            errors: [],
          }

          events.onStageComplete('research', result)

          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('Stage completed (12.3s)'),
            {stdio: 'pipe'},
          )
        })

        it('marks stage failed on failure', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          const result: StageExecutionResult = {
            stage: 'creation',
            status: 'failed',
            agentResults: {},
            startedAt: '2026-03-01T10:00:00.000Z',
            completedAt: '2026-03-01T10:00:05.000Z',
            errors: [{
              stage: 'creation',
              code: 'AGENT_TIMEOUT',
              message: 'Agent timed out',
              reason: 'exceeded 5m',
              resolution: 'Retry or increase timeout',
              severity: 'transient',
              timestamp: '2026-03-01T10:00:05.000Z',
            }],
          }

          events.onStageComplete('creation', result)

          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('Stage failed: Agent timed out'),
            {stdio: 'pipe'},
          )
        })

        it('marks stage as partial failure listing failed agents', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          const result: StageExecutionResult = {
            stage: 'research',
            status: 'partial',
            agentResults: {
              'trend-scout': {agentName: 'trend-scout', status: 'success', result: null, error: null, duration: 1000},
              'audience-researcher': {agentName: 'audience-researcher', status: 'failed', result: null, error: null, duration: 2000},
            },
            startedAt: '2026-03-01T10:00:00.000Z',
            completedAt: '2026-03-01T10:00:03.000Z',
            errors: [],
          }

          events.onStageComplete('research', result)

          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('Partial failure: audience-researcher failed'),
            {stdio: 'pipe'},
          )
        })
      })

      describe('onAgentFailed', () => {
        it('prints agent failure in the correct stage pane', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          events.onAgentFailed('trend-scout', new Error('Rate limited'))

          // trend-scout is in 'research' stage (pane 0)
          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining(`${SESSION_NAME}:0.0`),
            {stdio: 'pipe'},
          )
          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining('Agent failed: trend-scout — Rate limited'),
            {stdio: 'pipe'},
          )
        })

        it('does not throw for unknown agent names', () => {
          const events = router.buildEvents()

          // Should silently return without calling tmux
          expect(() => events.onAgentFailed('unknown-agent', new Error('oops')))
            .not.toThrow()
          expect(mockExecSync).not.toHaveBeenCalled()
        })

        it('routes seo-optimizer failure to optimization pane', () => {
          mockExecSync.mockReturnValueOnce(Buffer.from(''))
          const events = router.buildEvents()

          events.onAgentFailed('seo-optimizer', new Error('API error'))

          const optIndex = PIPELINE_STAGES.indexOf('optimization')
          expect(mockExecSync).toHaveBeenCalledWith(
            expect.stringContaining(`${SESSION_NAME}:0.${optIndex}`),
            {stdio: 'pipe'},
          )
        })
      })
    })
  })
})
