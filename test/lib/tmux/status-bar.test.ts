import {execSync} from 'node:child_process'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {PipelineStage} from '../../../src/lib/orchestrator/types.js'
import {PIPELINE_STAGES} from '../../../src/lib/orchestrator/types.js'
import {
  TmuxStatusBar,
  TmuxStatusBarError,
  TMUX_STATUS_BAR_ERROR,
  buildStageIndicators,
  calculateBudgetPercentage,
  formatElapsed,
  formatTokens,
  getCostColor,
  renderStageIndicator,
  renderStatusLine,
} from '../../../src/lib/tmux/status-bar.js'
import type {
  StageIndicator,
  StatusBarState,
} from '../../../src/lib/tmux/status-bar.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)

const SESSION_NAME = 'mat-550e8400-e29b-41d4-a716-446655440000'

// ============================================================
// Helper: create a default StatusBarState for testing
// ============================================================
function makeState(overrides: Partial<StatusBarState> = {}): StatusBarState {
  return {
    pipelineName: 'test-pipeline',
    currentStage: 'creation',
    stages: [
      {name: 'research', status: 'completed'},
      {name: 'strategy', status: 'completed'},
      {name: 'creation', status: 'current'},
      {name: 'optimization', status: 'pending'},
      {name: 'quality', status: 'pending'},
      {name: 'review', status: 'pending'},
      {name: 'distribution', status: 'pending'},
    ],
    elapsed: 754_000, // 12m34s
    tokens: 45_200,
    cost: 2.3,
    budgetLimit: 10,
    ...overrides,
  }
}

// ============================================================
// Task 5.1: Test status line rendering with different pipeline states
// ============================================================
describe('renderStatusLine()', () => {
  it('renders left with MAT prefix and stage indicators', () => {
    const state = makeState()
    const {left} = renderStatusLine(state)

    expect(left).toContain('MAT |')
    expect(left).toContain('✓ Research')
    expect(left).toContain('✓ Strategy')
    expect(left).toContain('▶ Creation')
    expect(left).toContain('· Optimization')
    expect(left).toContain('· Quality')
    expect(left).toContain('· Review')
    expect(left).toContain('· Distribution')
  })

  it('renders right with elapsed, tokens, and cost', () => {
    const state = makeState()
    const {right} = renderStatusLine(state)

    expect(right).toContain('⏱ 12m34s')
    expect(right).toContain('🔤 45.2K tokens')
    expect(right).toContain('$2.30/$10.00')
  })

  it('renders all stages as pending at pipeline start', () => {
    const state = makeState({
      currentStage: 'research',
      stages: PIPELINE_STAGES.map((name, index) => ({
        name,
        status: index === 0 ? 'current' as const : 'pending' as const,
      })),
      elapsed: 0,
      tokens: 0,
      cost: 0,
    })
    const {left, right} = renderStatusLine(state)

    expect(left).toContain('▶ Research')
    expect(left).toContain('· Strategy')
    expect(left).toContain('· Distribution')
    expect(right).toContain('⏱ 0s')
    expect(right).toContain('🔤 0 tokens')
    expect(right).toContain('$0.00/$10.00')
  })

  it('renders all stages as completed at pipeline end', () => {
    const state = makeState({
      currentStage: 'distribution',
      stages: PIPELINE_STAGES.map((name) => ({
        name,
        status: 'completed' as const,
      })),
      elapsed: 3_600_000, // 60m00s
      tokens: 1_200_000,
      cost: 9.5,
    })
    const {left, right} = renderStatusLine(state)

    for (const stage of PIPELINE_STAGES) {
      const capitalized = stage.charAt(0).toUpperCase() + stage.slice(1)
      expect(left).toContain(`✓ ${capitalized}`)
    }

    expect(right).toContain('⏱ 60m00s')
    expect(right).toContain('🔤 1.2M tokens')
    expect(right).toContain('$9.50/$10.00')
  })

  it('renders failed stage with red indicator', () => {
    const state = makeState({
      stages: [
        {name: 'research', status: 'completed'},
        {name: 'strategy', status: 'failed'},
        {name: 'creation', status: 'pending'},
        {name: 'optimization', status: 'pending'},
        {name: 'quality', status: 'pending'},
        {name: 'review', status: 'pending'},
        {name: 'distribution', status: 'pending'},
      ],
    })
    const {left} = renderStatusLine(state)

    expect(left).toContain('#[fg=red]')
    expect(left).toContain('✗ Strategy')
  })

  it('renders cost without limit when budgetLimit is 0', () => {
    const state = makeState({budgetLimit: 0, cost: 1.5})
    const {right} = renderStatusLine(state)

    expect(right).toContain('$1.50')
    expect(right).not.toContain('/$')
    expect(right).toContain('#[fg=green]')
  })

  it('formats large token counts as M', () => {
    const state = makeState({tokens: 2_500_000})
    const {right} = renderStatusLine(state)
    expect(right).toContain('2.5M tokens')
  })

  it('formats small token counts as plain numbers', () => {
    const state = makeState({tokens: 500})
    const {right} = renderStatusLine(state)
    expect(right).toContain('500 tokens')
  })
})

// ============================================================
// Task 5.2: Test budget threshold color transitions
// ============================================================
describe('calculateBudgetPercentage()', () => {
  it('returns 0 when budgetLimit is 0', () => {
    expect(calculateBudgetPercentage(5, 0)).toBe(0)
  })

  it('returns 0 when budgetLimit is negative', () => {
    expect(calculateBudgetPercentage(5, -1)).toBe(0)
  })

  it('calculates correct percentage', () => {
    expect(calculateBudgetPercentage(5, 10)).toBe(50)
  })

  it('returns 100 when cost equals limit', () => {
    expect(calculateBudgetPercentage(10, 10)).toBe(100)
  })

  it('returns > 100 when cost exceeds limit', () => {
    expect(calculateBudgetPercentage(15, 10)).toBe(150)
  })

  it('handles fractional costs', () => {
    expect(calculateBudgetPercentage(2.3, 10)).toBeCloseTo(23, 5)
  })
})

describe('getCostColor()', () => {
  it('returns green for 0%', () => {
    expect(getCostColor(0)).toBe('#[fg=green]')
  })

  it('returns green for 50%', () => {
    expect(getCostColor(50)).toBe('#[fg=green]')
  })

  it('returns green for 79.9%', () => {
    expect(getCostColor(79.9)).toBe('#[fg=green]')
  })

  it('returns yellow at exactly 80%', () => {
    expect(getCostColor(80)).toBe('#[fg=yellow]')
  })

  it('returns yellow for 90%', () => {
    expect(getCostColor(90)).toBe('#[fg=yellow]')
  })

  it('returns yellow for 99.9%', () => {
    expect(getCostColor(99.9)).toBe('#[fg=yellow]')
  })

  it('returns red at exactly 100%', () => {
    expect(getCostColor(100)).toBe('#[fg=red]')
  })

  it('returns red for 150%', () => {
    expect(getCostColor(150)).toBe('#[fg=red]')
  })
})

describe('budget threshold color integration', () => {
  it('renders green cost when under 80% budget', () => {
    const state = makeState({cost: 5, budgetLimit: 10}) // 50%
    const {right} = renderStatusLine(state)
    expect(right).toContain('#[fg=green]$5.00/$10.00')
  })

  it('renders yellow cost at 80% budget', () => {
    const state = makeState({cost: 8, budgetLimit: 10}) // 80%
    const {right} = renderStatusLine(state)
    expect(right).toContain('#[fg=yellow]$8.00/$10.00')
  })

  it('renders red cost at 100% budget', () => {
    const state = makeState({cost: 10, budgetLimit: 10}) // 100%
    const {right} = renderStatusLine(state)
    expect(right).toContain('#[fg=red]$10.00/$10.00')
  })

  it('renders red cost when over budget', () => {
    const state = makeState({cost: 12.5, budgetLimit: 10}) // 125%
    const {right} = renderStatusLine(state)
    expect(right).toContain('#[fg=red]$12.50/$10.00')
  })
})

// ============================================================
// Task 5.3: Test stage indicator rendering for all states
// ============================================================
describe('renderStageIndicator()', () => {
  it('renders pending stage with dim color and dot', () => {
    const indicator: StageIndicator = {name: 'research', status: 'pending'}
    const result = renderStageIndicator(indicator)
    expect(result).toContain('#[dim]')
    expect(result).toContain('· Research')
    expect(result).toContain('#[default]')
  })

  it('renders current stage with cyan bold and arrow', () => {
    const indicator: StageIndicator = {name: 'creation', status: 'current'}
    const result = renderStageIndicator(indicator)
    expect(result).toContain('#[fg=cyan,bold]')
    expect(result).toContain('▶ Creation')
    expect(result).toContain('#[default]')
  })

  it('renders completed stage with green and checkmark', () => {
    const indicator: StageIndicator = {name: 'strategy', status: 'completed'}
    const result = renderStageIndicator(indicator)
    expect(result).toContain('#[fg=green]')
    expect(result).toContain('✓ Strategy')
    expect(result).toContain('#[default]')
  })

  it('renders failed stage with red and X', () => {
    const indicator: StageIndicator = {name: 'optimization', status: 'failed'}
    const result = renderStageIndicator(indicator)
    expect(result).toContain('#[fg=red]')
    expect(result).toContain('✗ Optimization')
    expect(result).toContain('#[default]')
  })

  it('capitalizes stage names correctly', () => {
    const indicator: StageIndicator = {name: 'distribution', status: 'pending'}
    const result = renderStageIndicator(indicator)
    expect(result).toContain('Distribution')
  })
})

describe('buildStageIndicators()', () => {
  it('marks stages before current as pending when not in completed set', () => {
    const indicators = buildStageIndicators('creation', new Set(), new Set())
    expect(indicators[0]).toEqual({name: 'research', status: 'pending'})
    expect(indicators[1]).toEqual({name: 'strategy', status: 'pending'})
    expect(indicators[2]).toEqual({name: 'creation', status: 'current'})
  })

  it('marks completed stages correctly', () => {
    const completed = new Set<PipelineStage>(['research', 'strategy'])
    const indicators = buildStageIndicators('creation', completed, new Set())
    expect(indicators[0]).toEqual({name: 'research', status: 'completed'})
    expect(indicators[1]).toEqual({name: 'strategy', status: 'completed'})
    expect(indicators[2]).toEqual({name: 'creation', status: 'current'})
    expect(indicators[3]).toEqual({name: 'optimization', status: 'pending'})
  })

  it('marks failed stages correctly', () => {
    const completed = new Set<PipelineStage>(['research'])
    const failed = new Set<PipelineStage>(['strategy'])
    const indicators = buildStageIndicators('creation', completed, failed)
    expect(indicators[0]).toEqual({name: 'research', status: 'completed'})
    expect(indicators[1]).toEqual({name: 'strategy', status: 'failed'})
    expect(indicators[2]).toEqual({name: 'creation', status: 'current'})
  })

  it('failed status takes priority over completed', () => {
    const completed = new Set<PipelineStage>(['research'])
    const failed = new Set<PipelineStage>(['research'])
    const indicators = buildStageIndicators('strategy', completed, failed)
    expect(indicators[0]).toEqual({name: 'research', status: 'failed'})
  })

  it('returns all PIPELINE_STAGES in order', () => {
    const indicators = buildStageIndicators('research', new Set(), new Set())
    expect(indicators).toHaveLength(PIPELINE_STAGES.length)
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      expect(indicators[i].name).toBe(PIPELINE_STAGES[i])
    }
  })
})

// ============================================================
// Format helpers
// ============================================================
describe('formatElapsed()', () => {
  it('formats 0ms as 0s', () => {
    expect(formatElapsed(0)).toBe('0s')
  })

  it('formats seconds under a minute without padding', () => {
    expect(formatElapsed(5000)).toBe('5s')
  })

  it('formats exactly 60 seconds as 1m00s', () => {
    expect(formatElapsed(60_000)).toBe('1m00s')
  })

  it('formats 12m34s correctly', () => {
    expect(formatElapsed(754_000)).toBe('12m34s')
  })

  it('formats large elapsed times', () => {
    expect(formatElapsed(3_661_000)).toBe('61m01s')
  })

  it('truncates sub-second precision', () => {
    expect(formatElapsed(5500)).toBe('5s')
  })
})

describe('formatTokens()', () => {
  it('formats small counts as plain numbers', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(999)).toBe('999')
  })

  it('formats thousands with K suffix', () => {
    expect(formatTokens(1000)).toBe('1.0K')
    expect(formatTokens(45_200)).toBe('45.2K')
    expect(formatTokens(999_999)).toBe('1000.0K')
  })

  it('formats millions with M suffix', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M')
    expect(formatTokens(2_500_000)).toBe('2.5M')
  })
})

// ============================================================
// TmuxStatusBar class
// ============================================================
describe('TmuxStatusBar', () => {
  let statusBar: TmuxStatusBar

  beforeEach(() => {
    vi.resetAllMocks()
    statusBar = new TmuxStatusBar(SESSION_NAME)
  })

  describe('initialize()', () => {
    it('sets tmux status options', () => {
      statusBar.initialize()

      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status on`,
        {stdio: 'pipe'},
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status-interval 1`,
        {stdio: 'pipe'},
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status-left-length 80`,
        {stdio: 'pipe'},
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status-right-length 60`,
        {stdio: 'pipe'},
      )
    })

    it('throws TmuxStatusBarError when tmux command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('tmux server not started')
      })

      expect(() => statusBar.initialize()).toThrow(TmuxStatusBarError)
    })
  })

  describe('update()', () => {
    it('sets status-left and status-right via tmux', () => {
      const state = makeState()
      statusBar.update(state)

      expect(mockExecSync).toHaveBeenCalledTimes(2)

      // Verify status-left was set
      const leftCall = mockExecSync.mock.calls[0][0] as string
      expect(leftCall).toContain(`set-option -t ${SESSION_NAME} status-left`)
      expect(leftCall).toContain('MAT |')

      // Verify status-right was set
      const rightCall = mockExecSync.mock.calls[1][0] as string
      expect(rightCall).toContain(`set-option -t ${SESSION_NAME} status-right`)
      expect(rightCall).toContain('⏱')
    })

    it('throws TmuxStatusBarError when tmux command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('session not found')
      })

      expect(() => statusBar.update(makeState())).toThrow(TmuxStatusBarError)
    })
  })

  describe('clear()', () => {
    it('resets status-left and status-right to empty', () => {
      statusBar.clear()

      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status-left ''`,
        {stdio: 'pipe'},
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux set-option -t ${SESSION_NAME} status-right ''`,
        {stdio: 'pipe'},
      )
    })
  })
})

// ============================================================
// Error class
// ============================================================
describe('TmuxStatusBarError', () => {
  it('extends MATError with correct code', () => {
    const error = new TmuxStatusBarError('test message', 'test reason')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe(TMUX_STATUS_BAR_ERROR)
    expect(error.message).toBe('test message')
    expect(error.reason).toBe('test reason')
    expect(error.source).toBe('TmuxStatusBar')
    expect(error.severity).toBe('transient')
  })
})
