import {execSync} from 'node:child_process'

import type {PipelineStage} from '../orchestrator/types.js'
import {PIPELINE_STAGES} from '../orchestrator/types.js'
import {MATError} from '../utils/errors.js'

// ============================================================
// Error codes
// ============================================================

export const TMUX_STATUS_BAR_ERROR = 'TMUX_STATUS_BAR_ERROR'

// ============================================================
// Custom errors
// ============================================================

export class TmuxStatusBarError extends MATError {
  constructor(message: string, reason: string) {
    super(
      message,
      TMUX_STATUS_BAR_ERROR,
      reason,
      'Ensure the tmux session exists and status bar can be updated',
      'TmuxStatusBar',
      'transient',
    )
  }
}

// ============================================================
// Types
// ============================================================

export type StageIndicatorStatus = 'pending' | 'current' | 'completed' | 'failed'

export interface StageIndicator {
  name: PipelineStage
  status: StageIndicatorStatus
}

export interface StatusBarState {
  pipelineName: string
  currentStage: PipelineStage
  stages: StageIndicator[]
  elapsed: number // milliseconds
  tokens: number
  cost: number
  budgetLimit: number
}

export interface StatusBarLines {
  left: string
  right: string
}

// ============================================================
// Constants
// ============================================================

/** tmux color format strings */
const TMUX_GREEN = '#[fg=green]'
const TMUX_YELLOW = '#[fg=yellow]'
const TMUX_RED = '#[fg=red]'
const TMUX_CYAN_BOLD = '#[fg=cyan,bold]'
const TMUX_DIM = '#[dim]'
const TMUX_DEFAULT = '#[default]'

/** Stage indicator symbols */
const INDICATOR_COMPLETED = '✓'
const INDICATOR_CURRENT = '▶'
const INDICATOR_PENDING = '·'
const INDICATOR_FAILED = '✗'

/** Budget threshold percentages */
const BUDGET_WARNING_THRESHOLD = 80
const BUDGET_CRITICAL_THRESHOLD = 100

/** tmux status bar length limits */
const STATUS_LEFT_LENGTH = 80
const STATUS_RIGHT_LENGTH = 60

// ============================================================
// Pure rendering functions
// ============================================================

/**
 * Render a single stage indicator with tmux color codes.
 *
 * - pending: dim `[· StageName]`
 * - current: cyan bold `[▶ StageName]`
 * - completed: green `[✓ StageName]`
 * - failed: red `[✗ StageName]`
 */
export function renderStageIndicator(indicator: StageIndicator): string {
  const label = capitalizeStage(indicator.name)

  switch (indicator.status) {
    case 'completed': {
      return `${TMUX_GREEN}[${INDICATOR_COMPLETED} ${label}]${TMUX_DEFAULT}`
    }

    case 'current': {
      return `${TMUX_CYAN_BOLD}[${INDICATOR_CURRENT} ${label}]${TMUX_DEFAULT}`
    }

    case 'failed': {
      return `${TMUX_RED}[${INDICATOR_FAILED} ${label}]${TMUX_DEFAULT}`
    }

    case 'pending': {
      return `${TMUX_DIM}[${INDICATOR_PENDING} ${label}]${TMUX_DEFAULT}`
    }
  }
}

/**
 * Calculate the budget usage percentage.
 * Returns 0 when budgetLimit is 0 (no budget configured).
 */
export function calculateBudgetPercentage(cost: number, budgetLimit: number): number {
  if (budgetLimit <= 0) {
    return 0
  }

  return (cost / budgetLimit) * 100
}

/**
 * Determine the tmux color code for cost display based on budget percentage.
 *
 * - < 80%: green
 * - 80–99%: yellow (warning)
 * - >= 100%: red (critical / budget exceeded)
 */
export function getCostColor(budgetPercentage: number): string {
  if (budgetPercentage >= BUDGET_CRITICAL_THRESHOLD) {
    return TMUX_RED
  }

  if (budgetPercentage >= BUDGET_WARNING_THRESHOLD) {
    return TMUX_YELLOW
  }

  return TMUX_GREEN
}

/**
 * Format elapsed milliseconds as `Xm YYs` or `YYs` if under a minute.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = String(seconds).padStart(2, '0')

  if (minutes > 0) {
    return `${minutes}m${paddedSeconds}s`
  }

  return `${seconds}s`
}

/**
 * Format a token count for display (e.g., 45200 → "45.2K").
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`
  }

  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }

  return String(tokens)
}

/**
 * Build stage indicators from current pipeline state.
 * Creates an indicator for each PIPELINE_STAGE based on the current stage
 * and the provided completion/failure information.
 */
export function buildStageIndicators(
  currentStage: PipelineStage,
  completedStages: ReadonlySet<PipelineStage>,
  failedStages: ReadonlySet<PipelineStage>,
): StageIndicator[] {
  return PIPELINE_STAGES.map((stage) => {
    if (failedStages.has(stage)) {
      return {name: stage, status: 'failed' as const}
    }

    if (completedStages.has(stage)) {
      return {name: stage, status: 'completed' as const}
    }

    if (stage === currentStage) {
      return {name: stage, status: 'current' as const}
    }

    return {name: stage, status: 'pending' as const}
  })
}

/**
 * Render the full status bar left and right strings for tmux.
 *
 * Left:  `MAT | [✓ Research] [✓ Strategy] [▶ Creation] [· Optimization] ...`
 * Right: `⏱ 12m34s | 🔤 45.2K tokens | 💰 $2.30/$10.00`
 */
export function renderStatusLine(state: StatusBarState): StatusBarLines {
  // Build left: pipeline name + stage indicators
  const stageIndicators = state.stages.map((s) => renderStageIndicator(s)).join(' ')
  const left = `MAT | ${stageIndicators}`

  // Build right: elapsed, tokens, cost
  const elapsedStr = formatElapsed(state.elapsed)
  const tokensStr = formatTokens(state.tokens)
  const costStr = state.cost.toFixed(2)

  let costDisplay: string
  if (state.budgetLimit > 0) {
    const budgetPct = calculateBudgetPercentage(state.cost, state.budgetLimit)
    const color = getCostColor(budgetPct)
    const limitStr = state.budgetLimit.toFixed(2)
    costDisplay = `${color}$${costStr}/$${limitStr}${TMUX_DEFAULT}`
  } else {
    costDisplay = `${TMUX_GREEN}$${costStr}${TMUX_DEFAULT}`
  }

  const right = `⏱ ${elapsedStr} | 🔤 ${tokensStr} tokens | 💰 ${costDisplay}`

  return {left, right}
}

// ============================================================
// TmuxStatusBar class
// ============================================================

/**
 * Manages the tmux status bar display for pipeline progress monitoring.
 *
 * Configures tmux status-left and status-right options to show:
 * - Pipeline stage progress indicators (left)
 * - Elapsed time, token usage, and cost with budget coloring (right)
 *
 * Uses tmux's built-in refresh (`status-interval 1`) — no Node.js polling.
 */
export class TmuxStatusBar {
  private readonly sessionName: string

  constructor(sessionName: string) {
    this.sessionName = sessionName
  }

  /**
   * Initialize the tmux status bar with appropriate lengths and refresh interval.
   * @throws TmuxStatusBarError if tmux commands fail
   */
  initialize(): void {
    this.execTmux(`set-option -t ${this.sessionName} status on`)
    this.execTmux(`set-option -t ${this.sessionName} status-interval 1`)
    this.execTmux(`set-option -t ${this.sessionName} status-left-length ${STATUS_LEFT_LENGTH}`)
    this.execTmux(`set-option -t ${this.sessionName} status-right-length ${STATUS_RIGHT_LENGTH}`)
  }

  /**
   * Update the tmux status bar with the current pipeline state.
   * @throws TmuxStatusBarError if tmux commands fail
   */
  update(state: StatusBarState): void {
    const {left, right} = renderStatusLine(state)

    // Escape single quotes for shell
    const escapedLeft = left.replaceAll("'", "'\\''")
    const escapedRight = right.replaceAll("'", "'\\''")

    this.execTmux(`set-option -t ${this.sessionName} status-left '${escapedLeft}'`)
    this.execTmux(`set-option -t ${this.sessionName} status-right '${escapedRight}'`)
  }

  /**
   * Clear the status bar (reset to defaults) when the pipeline completes.
   */
  clear(): void {
    this.execTmux(`set-option -t ${this.sessionName} status-left ''`)
    this.execTmux(`set-option -t ${this.sessionName} status-right ''`)
  }

  /**
   * Execute a tmux command, wrapping errors in TmuxStatusBarError.
   */
  private execTmux(command: string): void {
    try {
      execSync(`tmux ${command}`, {stdio: 'pipe'})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TmuxStatusBarError(
        `Failed to update tmux status bar: ${command}`,
        message,
      )
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function capitalizeStage(stage: PipelineStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}
