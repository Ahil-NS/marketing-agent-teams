import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {LogEntry} from '../../src/lib/logging/types.js'
import {LogNotFoundError} from '../../src/lib/logging/errors.js'

// Mock the logging index module (the command imports from here)
vi.mock('../../src/lib/logging/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/lib/logging/index.js')>()
  return {
    ...original,
    readRunLog: vi.fn(),
  }
})

import {readRunLog} from '../../src/lib/logging/index.js'
import Logs from '../../src/commands/logs.js'

const mockedReadRunLog = readRunLog as ReturnType<typeof vi.fn>

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

async function* asyncGen(entries: LogEntry[]): AsyncGenerator<LogEntry> {
  for (const entry of entries) {
    yield entry
  }
}

describe('mat logs command', () => {
  let logOutput: string[]

  beforeEach(() => {
    logOutput = []
    vi.clearAllMocks()
  })

  function createCommandInstance(): Logs {
    const cmd = new Logs([], {} as any)
    cmd.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
    return cmd
  }

  it('streams and displays formatted log entries for a valid run-id', async () => {
    const entries = [
      makeEntry({timestamp: '2026-02-28T10:00:00.123Z', message: 'Pipeline started'}),
      makeEntry({timestamp: '2026-02-28T10:00:01.456Z', message: 'Stage started', component: 'stage-runner'}),
    ]
    mockedReadRunLog.mockReturnValue(asyncGen(entries))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'test-run-001'},
      flags: {level: undefined, component: undefined, tail: 0, follow: false, json: false},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toHaveLength(2)
    expect(logOutput[0]).toContain('10:00:00.123')
    expect(logOutput[0]).toContain('Pipeline started')
    expect(logOutput[1]).toContain('stage-runner')
  })

  it('applies --level filter to readRunLog', async () => {
    mockedReadRunLog.mockReturnValue(asyncGen([
      makeEntry({level: 'error', message: 'Error only'}),
    ]))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'test-run-001'},
      flags: {level: 'error', component: undefined, tail: 0, follow: false, json: false},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockedReadRunLog).toHaveBeenCalledWith(
      expect.any(String),
      'test-run-001',
      expect.objectContaining({level: 'error'}),
    )
  })

  it('applies --component filter to readRunLog', async () => {
    mockedReadRunLog.mockReturnValue(asyncGen([
      makeEntry({component: 'orchestrator', message: 'Filtered'}),
    ]))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'test-run-001'},
      flags: {level: undefined, component: 'orchestrator', tail: 0, follow: false, json: false},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    expect(mockedReadRunLog).toHaveBeenCalledWith(
      expect.any(String),
      'test-run-001',
      expect.objectContaining({component: 'orchestrator'}),
    )
  })

  it('applies --tail to show only last N entries', async () => {
    const entries = [
      makeEntry({message: 'Entry 1'}),
      makeEntry({message: 'Entry 2'}),
      makeEntry({message: 'Entry 3'}),
      makeEntry({message: 'Entry 4'}),
      makeEntry({message: 'Entry 5'}),
    ]
    mockedReadRunLog.mockReturnValue(asyncGen(entries))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'test-run-001'},
      flags: {level: undefined, component: undefined, tail: 2, follow: false, json: false},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    const result = await cmd.run()

    expect(result).toHaveLength(2)
    expect(logOutput).toHaveLength(2)
    expect(logOutput[0]).toContain('Entry 4')
    expect(logOutput[1]).toContain('Entry 5')
  })

  it('outputs raw NDJSON when --json flag is set', async () => {
    const entries = [makeEntry({message: 'JSON output'})]
    mockedReadRunLog.mockReturnValue(asyncGen(entries))

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'test-run-001'},
      flags: {level: undefined, component: undefined, tail: 0, follow: false, json: true},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    await cmd.run()

    // Verify the output is JSON
    const parsed = JSON.parse(logOutput[0])
    expect(parsed.message).toBe('JSON output')
  })

  it('formats LogNotFoundError with structured output for invalid run-id', async () => {
    mockedReadRunLog.mockImplementation(async function* () {
      throw new LogNotFoundError('bad-run-id')
    })

    const cmd = createCommandInstance()
    cmd.parse = vi.fn().mockResolvedValue({
      args: {'run-id': 'bad-run-id'},
      flags: {level: undefined, component: undefined, tail: 0, follow: false, json: false},
      argv: [],
      raw: [],
      metadata: {},
      nonExistentFlags: {},
    })

    // Command catches MATError and calls this.error() which throws oclif Error
    let caughtError: Error | undefined
    const _originalError = cmd.error.bind(cmd)
    cmd.error = ((msg: string) => {
      caughtError = new Error(msg)
      throw caughtError
    }) as any

    await expect(cmd.run()).rejects.toThrow()
    expect(caughtError?.message).toContain('LOG_NOT_FOUND')
    expect(caughtError?.message).toContain('Reason:')
    expect(caughtError?.message).toContain('Fix:')
  })
})
