import {execFileSync} from 'node:child_process'

import type {AgentExecutor} from './index.js'
import {ClaudeAgentExecutor} from './claude-agent-executor.js'
import {ClaudeCliExecutor} from './claude-cli-executor.js'

export type ExecutionMode = 'native' | 'sdk' | 'auto'

/**
 * Detects whether we're running inside a Claude Code session.
 * The CLAUDECODE env var blocks nested SDK query() calls.
 */
function isInsideClaudeCode(): boolean {
  return process.env.CLAUDECODE !== undefined
}

/**
 * Checks if the `claude` CLI binary is available in PATH.
 */
function isClaudeCliAvailable(): boolean {
  try {
    execFileSync('claude', ['--version'], {stdio: 'ignore', timeout: 5000})
    return true
  } catch {
    return false
  }
}

/**
 * Creates an AgentExecutor based on the requested mode.
 *
 * - `native`: Uses ClaudeCliExecutor (shells out to `claude -p`).
 *   Works inside Claude Code sessions. Requires `claude` CLI in PATH.
 *
 * - `sdk`: Uses ClaudeAgentExecutor (SDK query()). Fails inside
 *   Claude Code sessions due to CLAUDECODE env var blocking.
 *
 * - `auto` (default): Uses native if inside Claude Code or if
 *   `claude` CLI is available; falls back to SDK otherwise.
 */
export function createExecutor(mode: ExecutionMode = 'auto'): AgentExecutor {
  if (mode === 'native') {
    return new ClaudeCliExecutor()
  }

  if (mode === 'sdk') {
    if (isInsideClaudeCode()) {
      console.warn(
        '[WARN] SDK mode requested but running inside Claude Code session. ' +
        'SDK query() will fail due to CLAUDECODE env var. ' +
        'Consider using --mode native instead.',
      )
    }
    return new ClaudeAgentExecutor()
  }

  // Auto mode: prefer native when inside Claude Code or when CLI is available
  if (isInsideClaudeCode()) {
    return new ClaudeCliExecutor()
  }

  if (isClaudeCliAvailable()) {
    return new ClaudeCliExecutor()
  }

  return new ClaudeAgentExecutor()
}
