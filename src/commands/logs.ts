import {join} from 'node:path'

import {Args, Command, Flags} from '@oclif/core'

import {readRunLog} from '../lib/logging/index.js'
import type {LogEntry, LogLevel} from '../lib/logging/index.js'
import {MATError} from '../lib/utils/errors.js'

function formatLogLine(entry: LogEntry): string {
  const ts = entry.timestamp.slice(11, 23) // HH:mm:ss.SSS
  const level = entry.level.toUpperCase().padEnd(5)
  const component = entry.component.padEnd(20)
  return `[${ts}] ${level} [${component}] ${entry.message}`
}

export default class Logs extends Command {
  static override args = {
    'run-id': Args.string({
      description: 'Pipeline run ID to view logs for',
      required: true,
    }),
  }

  static override description = 'View pipeline run diagnostics logs'

  static enableJsonFlag = true

  static override flags = {
    component: Flags.string({
      description: 'Filter by component name (e.g., orchestrator, agent:trend-scout)',
      required: false,
    }),
    follow: Flags.boolean({
      char: 'f',
      default: false,
      description: 'Watch for new log entries in real-time',
    }),
    level: Flags.string({
      description: 'Filter by minimum log level',
      options: ['debug', 'info', 'warn', 'error'],
      required: false,
    }),
    tail: Flags.integer({
      default: 0,
      description: 'Show only the last N log entries',
    }),
  }

  async run(): Promise<LogEntry[]> {
    const {args, flags} = await this.parse(Logs)
    const matDir = join(process.cwd(), '.mat')

    if (flags.follow) {
      this.warn('--follow is not yet implemented. Showing current log entries instead.')
    }

    const filter = {
      ...(flags.level ? {level: flags.level as LogLevel} : {}),
      ...(flags.component ? {component: flags.component} : {}),
    }

    try {
      const entries: LogEntry[] = []
      for await (const entry of readRunLog(matDir, args['run-id'], filter)) {
        entries.push(entry)
      }

      // Apply --tail
      const output = flags.tail > 0 ? entries.slice(-flags.tail) : entries

      for (const entry of output) {
        this.log(flags.json ? JSON.stringify(entry) : formatLogLine(entry))
      }

      return output
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`[${error.code}] ${error.message}\nReason: ${error.reason}\nFix: ${error.resolution}`)
      }

      throw error
    }
  }
}
