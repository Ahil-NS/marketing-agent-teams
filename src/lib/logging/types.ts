export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Validates that a runId is safe for use in file paths.
 * Prevents path traversal attacks by ensuring runId matches UUID v4 format.
 */
const RUN_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export function validateRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`Invalid run ID format: ${runId}`)
  }
}

export interface LogEntry {
  timestamp: string // ISO 8601
  level: LogLevel
  component: string // e.g., 'orchestrator', 'agent:trend-scout'
  runId?: string
  message: string
  context?: Record<string, unknown>
}

export interface LoggerOptions {
  runId: string
  matDir: string // Absolute path to .mat/ directory
  minLevel?: LogLevel // Default: 'info'
}

export interface LogFilter {
  level?: LogLevel // Minimum level to include
  component?: string // Filter by component name
  since?: string // ISO 8601 timestamp — entries after this
  until?: string // ISO 8601 timestamp — entries before this
}
