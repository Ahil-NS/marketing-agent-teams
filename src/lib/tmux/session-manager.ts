import {execSync} from 'node:child_process'

import {PIPELINE_STAGES} from '../orchestrator/types.js'
import {validateRunId} from '../logging/types.js'
import {MATError} from '../utils/errors.js'

// ============================================================
// Error codes
// ============================================================

export const TMUX_NOT_FOUND = 'TMUX_NOT_FOUND'
export const TMUX_SESSION_ERROR = 'TMUX_SESSION_ERROR'
export const TMUX_SESSION_NOT_FOUND = 'TMUX_SESSION_NOT_FOUND'

// ============================================================
// Custom errors
// ============================================================

export class TmuxNotFoundError extends MATError {
  constructor() {
    super(
      'tmux not found — falling back to standard output',
      TMUX_NOT_FOUND,
      'tmux binary is not installed or not in $PATH',
      'Install tmux: brew install tmux (macOS) or apt install tmux (Linux)',
      'TmuxSessionManager',
      'permanent',
    )
  }
}

export class TmuxSessionError extends MATError {
  constructor(message: string, reason: string) {
    super(
      message,
      TMUX_SESSION_ERROR,
      reason,
      'Check tmux is running and the session name is valid',
      'TmuxSessionManager',
      'transient',
    )
  }
}

export class TmuxSessionNotFoundError extends MATError {
  constructor(sessionName: string) {
    super(
      `tmux session not found: ${sessionName}`,
      TMUX_SESSION_NOT_FOUND,
      `No active tmux session with name "${sessionName}"`,
      'Run `mat run --tmux` to create a new session, or `mat attach` to list active sessions',
      'TmuxSessionManager',
      'permanent',
    )
  }
}

// ============================================================
// Constants
// ============================================================

const SESSION_PREFIX = 'mat-'
const MIN_TERMINAL_WIDTH = 120

// ============================================================
// TmuxSessionManager
// ============================================================

export class TmuxSessionManager {
  /**
   * Check whether `tmux` is available on $PATH.
   */
  static isAvailable(): boolean {
    try {
      execSync('which tmux', {stdio: 'pipe'})
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a tmux session named `mat-<runId>` with one pane per pipeline stage.
   * @throws TmuxNotFoundError if tmux is not installed
   * @throws TmuxSessionError if session creation fails
   */
  create(runId: string): string {
    validateRunId(runId)

    if (!TmuxSessionManager.isAvailable()) {
      throw new TmuxNotFoundError()
    }

    const sessionName = `${SESSION_PREFIX}${runId}`

    try {
      // Create the session with the first stage pane
      execSync(`tmux new-session -d -s ${sessionName}`, {stdio: 'pipe'})

      // Create additional panes for remaining stages (already have 1 from new-session)
      for (let i = 1; i < PIPELINE_STAGES.length; i++) {
        execSync(`tmux split-window -t ${sessionName}`, {stdio: 'pipe'})
      }

      // Apply tiled layout for even distribution
      execSync(`tmux select-layout -t ${sessionName} tiled`, {stdio: 'pipe'})

      // Name each pane by sending a title command
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const stage = PIPELINE_STAGES[i]
        execSync(
          `tmux select-pane -t ${sessionName}:0.${i} -T "${stage}"`,
          {stdio: 'pipe'},
        )
      }

      // Check terminal width and warn if too narrow
      this.checkTerminalWidth(sessionName)

      return sessionName
    } catch (error) {
      // Attempt cleanup if session was partially created
      this.tryCleanup(sessionName)

      if (error instanceof MATError) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      throw new TmuxSessionError(
        `Failed to create tmux session: ${sessionName}`,
        message,
      )
    }
  }

  /**
   * Destroy (kill) a tmux session by run ID.
   * @throws TmuxSessionNotFoundError if the session does not exist
   */
  destroy(runId: string): void {
    validateRunId(runId)
    const sessionName = `${SESSION_PREFIX}${runId}`

    if (!this.sessionExists(sessionName)) {
      throw new TmuxSessionNotFoundError(sessionName)
    }

    try {
      execSync(`tmux kill-session -t ${sessionName}`, {stdio: 'pipe'})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TmuxSessionError(
        `Failed to destroy tmux session: ${sessionName}`,
        message,
      )
    }
  }

  /**
   * Attach to an existing tmux session by run ID.
   * @throws TmuxSessionNotFoundError if the session does not exist
   */
  attach(runId: string): void {
    validateRunId(runId)
    const sessionName = `${SESSION_PREFIX}${runId}`

    if (!this.sessionExists(sessionName)) {
      throw new TmuxSessionNotFoundError(sessionName)
    }

    try {
      execSync(`tmux attach-session -t ${sessionName}`, {stdio: 'inherit'})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TmuxSessionError(
        `Failed to attach to tmux session: ${sessionName}`,
        message,
      )
    }
  }

  /**
   * Detach from the currently attached tmux session.
   */
  detach(): void {
    try {
      execSync('tmux detach-client', {stdio: 'pipe'})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TmuxSessionError(
        'Failed to detach from tmux session',
        message,
      )
    }
  }

  /**
   * List all active `mat-*` tmux sessions and return their run IDs.
   */
  list(): string[] {
    if (!TmuxSessionManager.isAvailable()) {
      return []
    }

    try {
      const output = execSync("tmux list-sessions -F '#{session_name}'", {
        stdio: 'pipe',
        encoding: 'utf8',
      })

      return output
        .split('\n')
        .map((line) => line.trim())
        .filter((name) => name.startsWith(SESSION_PREFIX))
        .map((name) => name.slice(SESSION_PREFIX.length))
    } catch {
      // tmux server not running — no sessions
      return []
    }
  }

  // ---- Private helpers ----

  private sessionExists(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t ${sessionName}`, {stdio: 'pipe'})
      return true
    } catch {
      return false
    }
  }

  private checkTerminalWidth(sessionName: string): void {
    try {
      const widthStr = execSync(
        `tmux display-message -t ${sessionName} -p '#{window_width}'`,
        {stdio: 'pipe', encoding: 'utf8'},
      ).trim()
      const width = Number.parseInt(widthStr, 10)
      if (!Number.isNaN(width) && width < MIN_TERMINAL_WIDTH) {
        // Log warning but don't throw — non-fatal
        process.stderr.write(
          `Warning: Terminal width (${width}) is below recommended minimum (${MIN_TERMINAL_WIDTH} columns)\n`,
        )
      }
    } catch {
      // Ignore width check failures — non-critical
    }
  }

  private tryCleanup(sessionName: string): void {
    try {
      execSync(`tmux kill-session -t ${sessionName}`, {stdio: 'pipe'})
    } catch {
      // Best-effort cleanup
    }
  }
}
