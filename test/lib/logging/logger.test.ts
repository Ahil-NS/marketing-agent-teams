import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {mkdtemp, rm} from 'node:fs/promises'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {createLogger} from '../../../src/lib/logging/logger.js'
import {LogWriteError} from '../../../src/lib/logging/errors.js'
import type {LogEntry} from '../../../src/lib/logging/types.js'

// Valid UUID v4 run IDs for tests (validateRunId enforces UUID format)
const RUN_001 = 'b0000001-0000-0000-0000-000000000001'
const RUN_002 = 'b0000002-0000-0000-0000-000000000002'
const RUN_003 = 'b0000003-0000-0000-0000-000000000003'
const RUN_004 = 'b0000004-0000-0000-0000-000000000004'
const RUN_005 = 'b0000005-0000-0000-0000-000000000005'
const RUN_006 = 'b0000006-0000-0000-0000-000000000006'
const RUN_007 = 'b0000007-0000-0000-0000-000000000007'
const RUN_008 = 'b0000008-0000-0000-0000-000000000008'

describe('NDJSON Logger', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-logger-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  it('creates log directory and writes valid NDJSON', async () => {
    const logger = await createLogger({
      runId: RUN_001,
      matDir: tmpDir,
      minLevel: 'debug',
    })

    await logger.info('orchestrator', 'Pipeline started')

    const logPath = join(tmpDir, 'logs', RUN_001, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)

    const entry: LogEntry = JSON.parse(lines[0])
    expect(entry.level).toBe('info')
    expect(entry.component).toBe('orchestrator')
    expect(entry.runId).toBe(RUN_001)
    expect(entry.message).toBe('Pipeline started')
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('appends multiple entries on separate lines', async () => {
    const logger = await createLogger({
      runId: RUN_002,
      matDir: tmpDir,
      minLevel: 'debug',
    })

    await logger.info('orchestrator', 'Pipeline started')
    await logger.debug('agent-executor', 'Agent init')
    await logger.warn('budget-tracker', 'Budget warning')

    const logPath = join(tmpDir, 'logs', RUN_002, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(3)

    const entries = lines.map((l) => JSON.parse(l) as LogEntry)
    expect(entries[0].level).toBe('info')
    expect(entries[1].level).toBe('debug')
    expect(entries[2].level).toBe('warn')
  })

  it('includes all required fields in every entry', async () => {
    const logger = await createLogger({
      runId: RUN_003,
      matDir: tmpDir,
      minLevel: 'debug',
    })

    await logger.error('stage-runner', 'Stage failed', {stage: 'research', agentName: 'trend-scout'})

    const logPath = join(tmpDir, 'logs', RUN_003, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const entry: LogEntry = JSON.parse(content.trim())

    expect(entry).toHaveProperty('timestamp')
    expect(entry).toHaveProperty('level')
    expect(entry).toHaveProperty('component')
    expect(entry).toHaveProperty('runId')
    expect(entry).toHaveProperty('message')
    expect(entry).toHaveProperty('context')
    expect(entry.context).toEqual({stage: 'research', agentName: 'trend-scout'})
  })

  it('omits context field when not provided', async () => {
    const logger = await createLogger({
      runId: RUN_004,
      matDir: tmpDir,
      minLevel: 'debug',
    })

    await logger.info('orchestrator', 'No context here')

    const logPath = join(tmpDir, 'logs', RUN_004, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const entry = JSON.parse(content.trim())
    expect(entry).not.toHaveProperty('context')
  })

  it('respects minLevel filter — suppresses below-threshold entries', async () => {
    const logger = await createLogger({
      runId: RUN_005,
      matDir: tmpDir,
      minLevel: 'warn',
    })

    await logger.debug('orchestrator', 'Should be suppressed')
    await logger.info('orchestrator', 'Should also be suppressed')
    await logger.warn('orchestrator', 'Should be written')
    await logger.error('orchestrator', 'Should also be written')

    const logPath = join(tmpDir, 'logs', RUN_005, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)

    const entries = lines.map((l) => JSON.parse(l) as LogEntry)
    expect(entries[0].level).toBe('warn')
    expect(entries[1].level).toBe('error')
  })

  it('defaults minLevel to info', async () => {
    const logger = await createLogger({
      runId: RUN_006,
      matDir: tmpDir,
    })

    await logger.debug('orchestrator', 'Should be suppressed')
    await logger.info('orchestrator', 'Should be written')

    const logPath = join(tmpDir, 'logs', RUN_006, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(1)

    const entry: LogEntry = JSON.parse(lines[0])
    expect(entry.level).toBe('info')
  })

  it('generates ISO 8601 timestamps', async () => {
    const logger = await createLogger({
      runId: RUN_007,
      matDir: tmpDir,
    })

    await logger.info('orchestrator', 'Timestamp test')

    const logPath = join(tmpDir, 'logs', RUN_007, 'pipeline.ndjson')
    const content = await readFile(logPath, 'utf-8')
    const entry: LogEntry = JSON.parse(content.trim())

    // Validate ISO 8601 format
    const parsed = new Date(entry.timestamp)
    expect(parsed.toISOString()).toBe(entry.timestamp)
  })

  it('wraps I/O failures in LogWriteError', async () => {
    const logger = await createLogger({
      runId: RUN_008,
      matDir: tmpDir,
      minLevel: 'debug',
    })

    // Make the log directory read-only to force appendFile to fail
    const logDir = join(tmpDir, 'logs', RUN_008)
    const logPath = join(logDir, 'pipeline.ndjson')
    // Remove the file and make dir read-only
    const {chmod, rm: rmFile} = await import('node:fs/promises')
    await rmFile(logPath, {force: true})
    await chmod(logDir, 0o444)

    try {
      await expect(logger.info('orchestrator', 'Should fail')).rejects.toThrow(LogWriteError)
    } finally {
      // Restore permissions for cleanup
      await chmod(logDir, 0o755)
    }
  })

  it('rejects invalid runId with path traversal characters', async () => {
    await expect(
      createLogger({
        runId: '../../etc/passwd',
        matDir: tmpDir,
      }),
    ).rejects.toThrow('Invalid run ID format')
  })
})
