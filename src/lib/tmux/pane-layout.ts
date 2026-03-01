import {execSync} from 'node:child_process'

import type {PipelineStage, StageExecutionResult} from '../orchestrator/types.js'
import {PIPELINE_STAGES, STAGE_AGENT_MAP} from '../orchestrator/types.js'
import {MATError} from '../utils/errors.js'

// ============================================================
// Error codes
// ============================================================

export const TMUX_PANE_ROUTING_ERROR = 'TMUX_PANE_ROUTING_ERROR'

// ============================================================
// Custom errors
// ============================================================

export class TmuxPaneRoutingError extends MATError {
  constructor(message: string, reason: string) {
    super(
      message,
      TMUX_PANE_ROUTING_ERROR,
      reason,
      'Ensure the tmux session exists and pane indices are valid',
      'PaneLayout',
      'transient',
    )
  }
}

// ============================================================
// ANSI escape codes
// ============================================================

const ANSI_GREEN = '\x1b[32m'
const ANSI_RED = '\x1b[31m'
const ANSI_RESET = '\x1b[0m'

// ============================================================
// Separator format
// ============================================================

const SEPARATOR_LINE = '═══════════════════════════════════════'

// ============================================================
// PaneLayout interface
// ============================================================

/**
 * Maps pipeline stages to tmux pane indices within a session.
 */
export interface PaneLayout {
  /** The tmux session name (e.g., `mat-<run-id>`). */
  sessionName: string
  /** Maps each PipelineStage to its tmux pane index. */
  paneMap: Record<PipelineStage, number>
}

// ============================================================
// Core functions
// ============================================================

/**
 * Build a PaneLayout mapping each pipeline stage to a pane index.
 * Panes are assumed to already exist in the session (created by TmuxSessionManager).
 */
export function createLayout(sessionName: string): PaneLayout {
  const paneMap = {} as Record<PipelineStage, number>

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    paneMap[PIPELINE_STAGES[i]] = i
  }

  return {sessionName, paneMap}
}

/**
 * Return the tmux pane target string for a given stage.
 * Format: `<sessionName>:0.<paneIndex>`
 */
export function getPaneId(layout: PaneLayout, stage: PipelineStage): string {
  const index = layout.paneMap[stage]
  return `${layout.sessionName}:0.${index}`
}

// ============================================================
// Output routing
// ============================================================

/**
 * Send text content to the tmux pane assigned to the given stage.
 * Uses `tmux send-keys` to write content into the pane.
 */
export function routeOutput(layout: PaneLayout, stage: PipelineStage, content: string): void {
  const paneId = getPaneId(layout, stage)
  // Escape single quotes in content for shell safety
  const escaped = content.replaceAll("'", "'\\''")

  try {
    execSync(`tmux send-keys -t ${paneId} '${escaped}' Enter`, {stdio: 'pipe'})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new TmuxPaneRoutingError(
      `Failed to route output to pane ${paneId}`,
      message,
    )
  }
}

/**
 * Print a visual separator in the stage's pane when a new agent starts.
 * Format:
 * ```
 * ═══════════════════════════════════════
 * ▶ agent-name | 2026-03-01T10:30:00Z
 * ═══════════════════════════════════════
 * ```
 */
export function printSeparator(layout: PaneLayout, stage: PipelineStage, agentName: string): void {
  const timestamp = new Date().toISOString()
  const separator = [
    SEPARATOR_LINE,
    `▶ ${agentName} | ${timestamp}`,
    SEPARATOR_LINE,
  ].join('\n')

  routeOutput(layout, stage, separator)
}

// ============================================================
// Pane status indicators
// ============================================================

/**
 * Print a green checkmark with elapsed time in the stage's pane.
 */
export function markComplete(layout: PaneLayout, stage: PipelineStage, elapsed: number): void {
  const seconds = (elapsed / 1000).toFixed(1)
  const message = `${ANSI_GREEN}✓ Stage completed (${seconds}s)${ANSI_RESET}`
  routeOutput(layout, stage, message)
}

/**
 * Print a red X with error summary in the stage's pane.
 */
export function markFailed(layout: PaneLayout, stage: PipelineStage, errorSummary: string): void {
  const message = `${ANSI_RED}✗ Stage failed: ${errorSummary}${ANSI_RESET}`
  routeOutput(layout, stage, message)
}

// ============================================================
// StageOutputRouter — stream-like wrapper
// ============================================================

/**
 * Wraps PaneLayout to provide a per-stage stream-like interface for
 * routing output, printing separators, and marking completion/failure.
 */
export class StageOutputRouter {
  private readonly layout: PaneLayout

  constructor(layout: PaneLayout) {
    this.layout = layout
  }

  /** Get the underlying PaneLayout. */
  getLayout(): PaneLayout {
    return this.layout
  }

  /** Send content to the stage's pane. */
  write(stage: PipelineStage, content: string): void {
    routeOutput(this.layout, stage, content)
  }

  /** Print an agent separator in the stage's pane. */
  separator(stage: PipelineStage, agentName: string): void {
    printSeparator(this.layout, stage, agentName)
  }

  /** Mark a stage as completed with elapsed time. */
  complete(stage: PipelineStage, elapsed: number): void {
    markComplete(this.layout, stage, elapsed)
  }

  /** Mark a stage as failed with error summary. */
  fail(stage: PipelineStage, errorSummary: string): void {
    markFailed(this.layout, stage, errorSummary)
  }

  /**
   * Print a stage header when a stage starts.
   * Lists the agents that will run in this stage.
   */
  stageHeader(stage: PipelineStage): void {
    const agents = STAGE_AGENT_MAP[stage]
    const agentList = agents.length > 0 ? agents.join(', ') : '(human review)'
    const header = `🚀 Stage: ${stage} | Agents: ${agentList}`
    routeOutput(this.layout, stage, header)
  }

  /**
   * Build OrchestratorEvents callbacks that route output to tmux panes.
   * Wire these into the orchestrator to get automatic pane updates.
   */
  buildEvents(): {
    onStageStart: (stage: PipelineStage) => void
    onStageComplete: (stage: PipelineStage, result: StageExecutionResult) => void
    onAgentFailed: (agentName: string, error: Error) => void
  } {
    return {
      onStageStart: (stage: PipelineStage) => {
        this.stageHeader(stage)
      },
      onStageComplete: (stage: PipelineStage, result: StageExecutionResult) => {
        const start = new Date(result.startedAt).getTime()
        const end = new Date(result.completedAt).getTime()
        const elapsed = end - start

        if (result.status === 'completed') {
          this.complete(stage, elapsed)
        } else if (result.status === 'failed') {
          const errorSummary = result.errors.length > 0
            ? result.errors[0].message
            : 'Unknown error'
          this.fail(stage, errorSummary)
        } else if (result.status === 'partial') {
          const failedAgents = Object.entries(result.agentResults)
            .filter(([, r]) => r.status === 'failed')
            .map(([, r]) => r.agentName)
          this.fail(stage, `Partial failure: ${failedAgents.join(', ')} failed`)
        }
      },
      onAgentFailed: (agentName: string, error: Error) => {
        // Find which stage this agent belongs to
        for (const stage of PIPELINE_STAGES) {
          const agents = STAGE_AGENT_MAP[stage]
          if (agents.includes(agentName)) {
            const message = `${ANSI_RED}✗ Agent failed: ${agentName} — ${error.message}${ANSI_RESET}`
            routeOutput(this.layout, stage, message)
            return
          }
        }
      },
    }
  }
}
