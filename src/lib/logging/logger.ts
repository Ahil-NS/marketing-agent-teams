import {appendFile, mkdir} from 'node:fs/promises'
import {join} from 'node:path'

import {LogWriteError} from './errors.js'
import {LEVEL_ORDER, validateRunId} from './types.js'
import type {LogEntry, LogLevel, LoggerOptions} from './types.js'

export interface Logger {
  debug(component: string, message: string, context?: Record<string, unknown>): Promise<void>
  info(component: string, message: string, context?: Record<string, unknown>): Promise<void>
  warn(component: string, message: string, context?: Record<string, unknown>): Promise<void>
  error(component: string, message: string, context?: Record<string, unknown>): Promise<void>
}

export async function createLogger(options: LoggerOptions): Promise<Logger> {
  validateRunId(options.runId)
  const logDir = join(options.matDir, 'logs', options.runId)
  await mkdir(logDir, {recursive: true})
  const logPath = join(logDir, 'pipeline.ndjson')
  const minLevel = options.minLevel ?? 'info'

  async function writeEntry(
    level: LogLevel,
    component: string,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      runId: options.runId,
      message,
      ...(context !== undefined ? {context} : {}),
    }

    try {
      await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (error) {
      throw new LogWriteError(
        options.runId,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return {
    debug: (component, message, context) => writeEntry('debug', component, message, context),
    info: (component, message, context) => writeEntry('info', component, message, context),
    warn: (component, message, context) => writeEntry('warn', component, message, context),
    error: (component, message, context) => writeEntry('error', component, message, context),
  }
}
