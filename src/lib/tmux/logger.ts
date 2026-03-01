import {execSync} from 'node:child_process'
import {mkdirSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

import type {PipelineStage} from '../orchestrator/types.js'
import {PIPELINE_STAGES} from '../orchestrator/types.js'
import {validateRunId} from '../logging/types.js'
import {MATError} from '../utils/errors.js'

// ============================================================
// Error codes
// ============================================================

export const TMUX_LOG_CAPTURE_ERROR = 'TMUX_LOG_CAPTURE_ERROR'

// ============================================================
// Custom errors
// ============================================================

export class TmuxLogCaptureError extends MATError {
  constructor(message: string, reason: string) {
    super(
      message,
      TMUX_LOG_CAPTURE_ERROR,
      reason,
      'Check tmux session is active and log directory is writable',
      'TmuxLogger',
      'transient',
    )
  }
}

// ============================================================
// Constants
// ============================================================

const SESSION_PREFIX = 'mat-'

/**
 * Maps pipeline stage names to log file names.
 */
const STAGE_LOG_FILES: Record<PipelineStage, string> = {
  research: 'research.log',
  strategy: 'strategy.log',
  creation: 'creation.log',
  optimization: 'optimization.log',
  quality: 'quality.log',
  review: 'review.log',
  distribution: 'distribution.log',
}

// ============================================================
// TmuxLogger
// ============================================================

export class TmuxLogger {
  /**
   * Enable pipe-pane capture for all panes in a tmux session.
   * Each pane's output is appended to `.mat/logs/<runId>/<stage>.log`.
   *
   * @param sessionName - The tmux session name (e.g., `mat-<runId>`)
   * @param runId - The pipeline run UUID
   * @param matDir - Absolute path to the `.mat/` directory
   * @throws TmuxLogCaptureError if pipe-pane command fails
   */
  enableCapture(sessionName: string, runId: string, matDir: string): void {
    validateRunId(runId)

    const logDir = join(matDir, 'logs', runId)
    mkdirSync(logDir, {recursive: true})

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i]
      const logPath = join(logDir, STAGE_LOG_FILES[stage])
      const paneTarget = `${sessionName}:0.${i}`

      try {
        execSync(
          `tmux pipe-pane -t ${paneTarget} 'cat >> ${logPath}'`,
          {stdio: 'pipe'},
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new TmuxLogCaptureError(
          `Failed to enable log capture for pane ${paneTarget}`,
          message,
        )
      }
    }
  }

  /**
   * Disable pipe-pane capture for all panes in a tmux session.
   * Runs `tmux pipe-pane -t <pane>` with no command to stop capture.
   *
   * @param sessionName - The tmux session name (e.g., `mat-<runId>`)
   */
  disableCapture(sessionName: string): void {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const paneTarget = `${sessionName}:0.${i}`

      try {
        execSync(`tmux pipe-pane -t ${paneTarget}`, {stdio: 'pipe'})
      } catch {
        // Best-effort — pane may no longer exist
      }
    }
  }

  /**
   * Build the pipe-pane command string for a given stage.
   * Exposed for testing — not part of public API.
   */
  static buildPipePaneCommand(
    sessionName: string,
    paneIndex: number,
    logPath: string,
  ): string {
    const paneTarget = `${sessionName}:0.${paneIndex}`
    return `tmux pipe-pane -t ${paneTarget} 'cat >> ${logPath}'`
  }

  /**
   * Build the disable pipe-pane command string.
   * Exposed for testing — not part of public API.
   */
  static buildDisableCommand(sessionName: string, paneIndex: number): string {
    const paneTarget = `${sessionName}:0.${paneIndex}`
    return `tmux pipe-pane -t ${paneTarget}`
  }

  /**
   * Get the log file path for a given stage.
   */
  static getLogPath(matDir: string, runId: string, stage: PipelineStage): string {
    return join(matDir, 'logs', runId, STAGE_LOG_FILES[stage])
  }

  /**
   * Get the log directory for a given run.
   */
  static getLogDir(matDir: string, runId: string): string {
    return join(matDir, 'logs', runId)
  }
}

// ============================================================
// Recent completed runs
// ============================================================

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

/**
 * List recent completed pipeline runs by scanning `.mat/logs/` directory.
 * Returns run IDs sorted by modification time (most recent first), limited to `limit` entries.
 */
export function listRecentLogDirs(matDir: string, limit = 5): Array<{runId: string; logDir: string; mtime: Date}> {
  const logsDir = join(matDir, 'logs')

  let entries: string[]
  try {
    entries = readdirSync(logsDir)
  } catch {
    return []
  }

  const uuidDirs = entries.filter((name) => UUID_PATTERN.test(name))

  const withStats: Array<{runId: string; logDir: string; mtime: Date}> = []
  for (const name of uuidDirs) {
    const dirPath = join(logsDir, name)
    try {
      const st = statSync(dirPath)
      if (st.isDirectory()) {
        withStats.push({runId: name, logDir: dirPath, mtime: st.mtime})
      }
    } catch {
      // Skip inaccessible entries
    }
  }

  withStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  return withStats.slice(0, limit)
}

// ============================================================
// Session listing for mat attach
// ============================================================

/**
 * Format active session list for CLI display.
 */
export function formatActiveSessionList(runIds: string[]): string {
  const lines = ['Active pipeline sessions:']
  for (const runId of runIds) {
    lines.push(`  ${SESSION_PREFIX}${runId}`)
  }

  lines.push('')
  lines.push('Attach with: mat attach <run-id>')
  return lines.join('\n')
}

/**
 * Format the "no active sessions" message with recent completed runs.
 */
export function formatNoActiveSessions(recentRuns: Array<{runId: string; logDir: string}>): string {
  const lines = ['No active pipeline sessions.']

  if (recentRuns.length > 0) {
    lines.push('')
    lines.push('Recent completed runs:')
    for (const run of recentRuns) {
      lines.push(`  ${run.runId}  →  ${run.logDir}`)
    }

    lines.push('')
    lines.push('Start a new session with: mat run --tmux')
  }

  return lines.join('\n')
}
