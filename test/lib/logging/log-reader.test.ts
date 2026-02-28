import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {mkdtemp, rm} from 'node:fs/promises'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {getLogFilePath, readRunLog} from '../../../src/lib/logging/log-reader.js'
import {LogNotFoundError} from '../../../src/lib/logging/errors.js'
import type {LogEntry} from '../../../src/lib/logging/types.js'

// Valid UUID v4 run IDs for tests (validateRunId enforces UUID format)
const RUN_001 = 'a0000001-0000-0000-0000-000000000001'
const RUN_002 = 'a0000002-0000-0000-0000-000000000002'
const RUN_003 = 'a0000003-0000-0000-0000-000000000003'
const RUN_004 = 'a0000004-0000-0000-0000-000000000004'
const RUN_005 = 'a0000005-0000-0000-0000-000000000005'
const RUN_006 = 'a0000006-0000-0000-0000-000000000006'
const RUN_MISSING = 'a0000099-0000-0000-0000-000000000099'

async function writeNdjsonFixture(matDir: string, runId: string, entries: LogEntry[]): Promise<void> {
  const logDir = join(matDir, 'logs', runId)
  await mkdir(logDir, {recursive: true})
  const logPath = join(logDir, 'pipeline.ndjson')
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await writeFile(logPath, content, 'utf-8')
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-02-28T10:00:00.000Z',
    level: 'info',
    component: 'orchestrator',
    runId: 'test-run',
    message: 'Test message',
    ...overrides,
  }
}

describe('Log Reader', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-log-reader-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('getLogFilePath', () => {
    it('resolves correct path', () => {
      const path = getLogFilePath('/project/.mat', RUN_001)
      expect(path).toBe(join('/project/.mat', 'logs', RUN_001, 'pipeline.ndjson'))
    })

    it('rejects invalid runId with path traversal characters', () => {
      expect(() => getLogFilePath('/project/.mat', '../../etc/passwd')).toThrow('Invalid run ID format')
    })
  })

  describe('readRunLog', () => {
    it('parses valid NDJSON into LogEntry objects', async () => {
      const entries = [
        makeEntry({timestamp: '2026-02-28T10:00:00.000Z', message: 'First'}),
        makeEntry({timestamp: '2026-02-28T10:00:01.000Z', message: 'Second'}),
        makeEntry({timestamp: '2026-02-28T10:00:02.000Z', message: 'Third'}),
      ]
      await writeNdjsonFixture(tmpDir, RUN_001, entries)

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_001)) {
        result.push(entry)
      }

      expect(result).toHaveLength(3)
      expect(result[0].message).toBe('First')
      expect(result[1].message).toBe('Second')
      expect(result[2].message).toBe('Third')
    })

    it('filters by minimum level', async () => {
      const entries = [
        makeEntry({level: 'debug', message: 'Debug'}),
        makeEntry({level: 'info', message: 'Info'}),
        makeEntry({level: 'warn', message: 'Warn'}),
        makeEntry({level: 'error', message: 'Error'}),
      ]
      await writeNdjsonFixture(tmpDir, RUN_002, entries)

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_002, {level: 'warn'})) {
        result.push(entry)
      }

      expect(result).toHaveLength(2)
      expect(result[0].level).toBe('warn')
      expect(result[1].level).toBe('error')
    })

    it('filters by component', async () => {
      const entries = [
        makeEntry({component: 'orchestrator', message: 'Orch'}),
        makeEntry({component: 'agent-executor', message: 'Agent'}),
        makeEntry({component: 'orchestrator', message: 'Orch2'}),
      ]
      await writeNdjsonFixture(tmpDir, RUN_003, entries)

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_003, {component: 'orchestrator'})) {
        result.push(entry)
      }

      expect(result).toHaveLength(2)
      expect(result.every((e) => e.component === 'orchestrator')).toBe(true)
    })

    it('filters by time range (since/until)', async () => {
      const entries = [
        makeEntry({timestamp: '2026-02-28T10:00:00.000Z', message: 'Early'}),
        makeEntry({timestamp: '2026-02-28T11:00:00.000Z', message: 'Mid'}),
        makeEntry({timestamp: '2026-02-28T12:00:00.000Z', message: 'Late'}),
      ]
      await writeNdjsonFixture(tmpDir, RUN_004, entries)

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_004, {
        since: '2026-02-28T10:30:00.000Z',
        until: '2026-02-28T11:30:00.000Z',
      })) {
        result.push(entry)
      }

      expect(result).toHaveLength(1)
      expect(result[0].message).toBe('Mid')
    })

    it('throws LogNotFoundError for missing log file', async () => {
      await expect(async () => {
        const entries: LogEntry[] = []
        for await (const entry of readRunLog(tmpDir, RUN_MISSING)) {
          entries.push(entry)
        }
      }).rejects.toThrow(LogNotFoundError)
    })

    it('LogNotFoundError includes resolution path', async () => {
      try {
        for await (const _ of readRunLog(tmpDir, RUN_MISSING)) {
          // Should not reach
        }
      } catch (error) {
        expect(error).toBeInstanceOf(LogNotFoundError)
        const logError = error as LogNotFoundError
        expect(logError.resolution).toContain('mat status')
        expect(logError.code).toBe('LOG_NOT_FOUND')
      }
    })

    it('rejects invalid runId with path traversal', async () => {
      await expect(async () => {
        for await (const _ of readRunLog(tmpDir, '../../../etc')) {
          // Should not reach
        }
      }).rejects.toThrow('Invalid run ID format')
    })

    it('skips malformed NDJSON lines without aborting', async () => {
      const logDir = join(tmpDir, 'logs', RUN_005)
      await mkdir(logDir, {recursive: true})
      const logPath = join(logDir, 'pipeline.ndjson')
      const content = [
        JSON.stringify(makeEntry({message: 'Valid 1'})),
        'this is not valid json {{{',
        JSON.stringify(makeEntry({message: 'Valid 2'})),
        '',
        JSON.stringify(makeEntry({message: 'Valid 3'})),
      ].join('\n') + '\n'
      await writeFile(logPath, content, 'utf-8')

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_005)) {
        result.push(entry)
      }

      expect(result).toHaveLength(3)
      expect(result[0].message).toBe('Valid 1')
      expect(result[1].message).toBe('Valid 2')
      expect(result[2].message).toBe('Valid 3')
    })

    it('handles empty log file', async () => {
      const logDir = join(tmpDir, 'logs', RUN_006)
      await mkdir(logDir, {recursive: true})
      const logPath = join(logDir, 'pipeline.ndjson')
      await writeFile(logPath, '', 'utf-8')

      const result: LogEntry[] = []
      for await (const entry of readRunLog(tmpDir, RUN_006)) {
        result.push(entry)
      }

      expect(result).toHaveLength(0)
    })
  })
})
