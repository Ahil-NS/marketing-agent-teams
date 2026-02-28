import {createReadStream} from 'node:fs'
import {access} from 'node:fs/promises'
import {join} from 'node:path'
import {createInterface} from 'node:readline'

import {LogNotFoundError} from './errors.js'
import {LEVEL_ORDER, validateRunId} from './types.js'
import type {LogEntry, LogFilter} from './types.js'

export function getLogFilePath(matDir: string, runId: string): string {
  validateRunId(runId)
  return join(matDir, 'logs', runId, 'pipeline.ndjson')
}

export async function* readRunLog(
  matDir: string,
  runId: string,
  filter?: LogFilter,
): AsyncGenerator<LogEntry> {
  const logPath = getLogFilePath(matDir, runId)

  try {
    await access(logPath)
  } catch {
    throw new LogNotFoundError(runId)
  }

  const rl = createInterface({
    input: createReadStream(logPath, 'utf-8'),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.trim()) continue

    let entry: LogEntry
    try {
      entry = JSON.parse(line) as LogEntry
    } catch {
      // Skip malformed NDJSON lines — do not abort the read
      continue
    }

    // Apply filters
    if (filter?.level && LEVEL_ORDER[entry.level] < LEVEL_ORDER[filter.level]) continue
    if (filter?.component && entry.component !== filter.component) continue
    if (filter?.since && entry.timestamp < filter.since) continue
    if (filter?.until && entry.timestamp > filter.until) continue

    yield entry
  }
}
