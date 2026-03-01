import {execSync} from 'node:child_process'
import {mkdirSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {PIPELINE_STAGES} from '../../../src/lib/orchestrator/types.js'
import {
  TmuxLogger,
  TmuxLogCaptureError,
  TMUX_LOG_CAPTURE_ERROR,
  listRecentLogDirs,
  formatActiveSessionList,
  formatNoActiveSessions,
} from '../../../src/lib/tmux/logger.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)
const mockMkdirSync = vi.mocked(mkdirSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockStatSync = vi.mocked(statSync)

const VALID_RUN_ID = '550e8400-e29b-41d4-a716-446655440000'
const SESSION_NAME = `mat-${VALID_RUN_ID}`
const MAT_DIR = '/project/.mat'

describe('TmuxLogger', () => {
  let logger: TmuxLogger

  beforeEach(() => {
    logger = new TmuxLogger()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==================================================================
  // Task 6.1: Test pipe-pane command generation for each pane/stage
  // ==================================================================
  describe('enableCapture()', () => {
    it('creates log directory and enables pipe-pane for all 7 stages', () => {
      // All pipe-pane calls succeed
      mockExecSync.mockReturnValue(Buffer.from(''))

      logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR)

      // Verify log directory creation
      expect(mockMkdirSync).toHaveBeenCalledWith(
        join(MAT_DIR, 'logs', VALID_RUN_ID),
        {recursive: true},
      )

      // Verify pipe-pane for each stage
      expect(mockExecSync).toHaveBeenCalledTimes(PIPELINE_STAGES.length)

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const stage = PIPELINE_STAGES[i]
        const logPath = join(MAT_DIR, 'logs', VALID_RUN_ID, `${stage}.log`)
        expect(mockExecSync).toHaveBeenCalledWith(
          `tmux pipe-pane -t ${SESSION_NAME}:0.${i} 'cat >> ${logPath}'`,
          {stdio: 'pipe'},
        )
      }
    })

    it('generates correct pipe-pane command for research stage (pane 0)', () => {
      mockExecSync.mockReturnValue(Buffer.from(''))

      logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR)

      const expectedPath = join(MAT_DIR, 'logs', VALID_RUN_ID, 'research.log')
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux pipe-pane -t ${SESSION_NAME}:0.0 'cat >> ${expectedPath}'`,
        {stdio: 'pipe'},
      )
    })

    it('generates correct pipe-pane command for distribution stage (pane 6)', () => {
      mockExecSync.mockReturnValue(Buffer.from(''))

      logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR)

      const expectedPath = join(MAT_DIR, 'logs', VALID_RUN_ID, 'distribution.log')
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux pipe-pane -t ${SESSION_NAME}:0.6 'cat >> ${expectedPath}'`,
        {stdio: 'pipe'},
      )
    })

    it('throws TmuxLogCaptureError when pipe-pane fails', () => {
      // First call succeeds (research), second fails (strategy)
      mockExecSync
        .mockReturnValueOnce(Buffer.from(''))
        .mockImplementationOnce(() => {
          throw new Error('pane not found')
        })

      expect(() => logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR))
        .toThrow(TmuxLogCaptureError)
    })

    it('TmuxLogCaptureError has correct error code', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('session not found')
      })

      try {
        logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR)
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(TmuxLogCaptureError)
        expect((error as TmuxLogCaptureError).code).toBe(TMUX_LOG_CAPTURE_ERROR)
      }
    })

    // ==================================================================
    // Task 6.3: Test run-id validation prevents path traversal
    // ==================================================================
    it('rejects invalid run-id to prevent path traversal', () => {
      expect(() => logger.enableCapture(SESSION_NAME, '../../../etc/passwd', MAT_DIR))
        .toThrow('Invalid run ID format')
    })

    it('rejects run-id with slashes', () => {
      expect(() => logger.enableCapture(SESSION_NAME, 'abc/def', MAT_DIR))
        .toThrow('Invalid run ID format')
    })

    it('rejects empty run-id', () => {
      expect(() => logger.enableCapture(SESSION_NAME, '', MAT_DIR))
        .toThrow('Invalid run ID format')
    })
  })

  // ==================================================================
  // Task 6.4: Test capture enable/disable lifecycle
  // ==================================================================
  describe('disableCapture()', () => {
    it('disables pipe-pane for all 7 panes', () => {
      mockExecSync.mockReturnValue(Buffer.from(''))

      logger.disableCapture(SESSION_NAME)

      expect(mockExecSync).toHaveBeenCalledTimes(PIPELINE_STAGES.length)

      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        expect(mockExecSync).toHaveBeenCalledWith(
          `tmux pipe-pane -t ${SESSION_NAME}:0.${i}`,
          {stdio: 'pipe'},
        )
      }
    })

    it('silently ignores errors for individual panes (best-effort)', () => {
      // Some panes may have already been destroyed
      mockExecSync
        .mockReturnValueOnce(Buffer.from(''))
        .mockImplementationOnce(() => {
          throw new Error('pane gone')
        })
        .mockReturnValueOnce(Buffer.from(''))
        .mockImplementationOnce(() => {
          throw new Error('pane gone')
        })
        .mockReturnValue(Buffer.from(''))

      // Should not throw
      expect(() => logger.disableCapture(SESSION_NAME)).not.toThrow()
      expect(mockExecSync).toHaveBeenCalledTimes(PIPELINE_STAGES.length)
    })
  })

  describe('enable → disable lifecycle', () => {
    it('can enable then disable capture without errors', () => {
      mockExecSync.mockReturnValue(Buffer.from(''))

      logger.enableCapture(SESSION_NAME, VALID_RUN_ID, MAT_DIR)
      logger.disableCapture(SESSION_NAME)

      // 7 enable + 7 disable = 14 execSync calls
      expect(mockExecSync).toHaveBeenCalledTimes(PIPELINE_STAGES.length * 2)
    })
  })

  // ==================================================================
  // Task 6.2: Test log directory creation with correct path structure
  // ==================================================================
  describe('static helpers', () => {
    it('buildPipePaneCommand generates correct command', () => {
      const logPath = '/project/.mat/logs/run-id/research.log'
      const cmd = TmuxLogger.buildPipePaneCommand('mat-run-id', 0, logPath)
      expect(cmd).toBe(`tmux pipe-pane -t mat-run-id:0.0 'cat >> ${logPath}'`)
    })

    it('buildDisableCommand generates correct command', () => {
      const cmd = TmuxLogger.buildDisableCommand('mat-run-id', 3)
      expect(cmd).toBe('tmux pipe-pane -t mat-run-id:0.3')
    })

    it('getLogPath returns correct path for each stage', () => {
      const path = TmuxLogger.getLogPath(MAT_DIR, VALID_RUN_ID, 'optimization')
      expect(path).toBe(join(MAT_DIR, 'logs', VALID_RUN_ID, 'optimization.log'))
    })

    it('getLogDir returns correct directory path', () => {
      const dir = TmuxLogger.getLogDir(MAT_DIR, VALID_RUN_ID)
      expect(dir).toBe(join(MAT_DIR, 'logs', VALID_RUN_ID))
    })
  })
})

// ==================================================================
// listRecentLogDirs
// ==================================================================
describe('listRecentLogDirs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when logs directory does not exist', () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const result = listRecentLogDirs(MAT_DIR)
    expect(result).toEqual([])
  })

  it('filters to only UUID-formatted directories', () => {
    mockReaddirSync.mockReturnValue([
      'not-a-uuid',
      VALID_RUN_ID,
      'some-file.json',
      '660e8400-e29b-41d4-a716-446655440001',
    ] as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation((dirPath) => {
      return {
        isDirectory: () => true,
        mtime: new Date('2026-03-01T10:00:00Z'),
      } as ReturnType<typeof statSync>
    })

    const result = listRecentLogDirs(MAT_DIR)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.runId)).toContain(VALID_RUN_ID)
    expect(result.map((r) => r.runId)).toContain('660e8400-e29b-41d4-a716-446655440001')
  })

  it('sorts by modification time descending (most recent first)', () => {
    const id1 = '110e8400-e29b-41d4-a716-446655440001'
    const id2 = '220e8400-e29b-41d4-a716-446655440002'
    const id3 = '330e8400-e29b-41d4-a716-446655440003'

    mockReaddirSync.mockReturnValue([id1, id2, id3] as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation((dirPath) => {
      const path = String(dirPath)
      if (path.includes(id1)) {
        return {isDirectory: () => true, mtime: new Date('2026-01-01')} as ReturnType<typeof statSync>
      }

      if (path.includes(id2)) {
        return {isDirectory: () => true, mtime: new Date('2026-03-01')} as ReturnType<typeof statSync>
      }

      return {isDirectory: () => true, mtime: new Date('2026-02-01')} as ReturnType<typeof statSync>
    })

    const result = listRecentLogDirs(MAT_DIR)
    expect(result[0].runId).toBe(id2) // most recent
    expect(result[1].runId).toBe(id3)
    expect(result[2].runId).toBe(id1) // oldest
  })

  it('limits results to specified count', () => {
    const ids = Array.from({length: 10}, (_, i) =>
      `${String(i).padStart(2, '0')}0e8400-e29b-41d4-a716-446655440000`,
    )

    mockReaddirSync.mockReturnValue(ids as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => true,
      mtime: new Date(),
    }) as ReturnType<typeof statSync>)

    const result = listRecentLogDirs(MAT_DIR, 3)
    expect(result).toHaveLength(3)
  })

  it('defaults to 5 results', () => {
    const ids = Array.from({length: 10}, (_, i) =>
      `${String(i).padStart(2, '0')}0e8400-e29b-41d4-a716-446655440000`,
    )

    mockReaddirSync.mockReturnValue(ids as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => true,
      mtime: new Date(),
    }) as ReturnType<typeof statSync>)

    const result = listRecentLogDirs(MAT_DIR)
    expect(result).toHaveLength(5)
  })

  it('skips entries that are not directories', () => {
    mockReaddirSync.mockReturnValue([VALID_RUN_ID] as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => false,
      mtime: new Date(),
    }) as ReturnType<typeof statSync>)

    const result = listRecentLogDirs(MAT_DIR)
    expect(result).toHaveLength(0)
  })

  it('skips entries where stat throws', () => {
    const goodId = VALID_RUN_ID
    const badId = '660e8400-e29b-41d4-a716-446655440001'

    mockReaddirSync.mockReturnValue([goodId, badId] as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation((dirPath) => {
      if (String(dirPath).includes(badId)) {
        throw new Error('Permission denied')
      }

      return {
        isDirectory: () => true,
        mtime: new Date('2026-03-01'),
      } as ReturnType<typeof statSync>
    })

    const result = listRecentLogDirs(MAT_DIR)
    expect(result).toHaveLength(1)
    expect(result[0].runId).toBe(goodId)
  })

  it('includes logDir path in results', () => {
    mockReaddirSync.mockReturnValue([VALID_RUN_ID] as unknown as ReturnType<typeof readdirSync>)

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => true,
      mtime: new Date('2026-03-01'),
    }) as ReturnType<typeof statSync>)

    const result = listRecentLogDirs(MAT_DIR)
    expect(result[0].logDir).toBe(join(MAT_DIR, 'logs', VALID_RUN_ID))
  })
})

// ==================================================================
// Task 6.5: Test mat attach output formatting
// ==================================================================
describe('formatActiveSessionList', () => {
  it('formats active sessions with prefix and usage hint', () => {
    const output = formatActiveSessionList(['run-1', 'run-2'])
    expect(output).toContain('Active pipeline sessions:')
    expect(output).toContain('  mat-run-1')
    expect(output).toContain('  mat-run-2')
    expect(output).toContain('Attach with: mat attach <run-id>')
  })

  it('formats single session', () => {
    const output = formatActiveSessionList([VALID_RUN_ID])
    expect(output).toContain(`  mat-${VALID_RUN_ID}`)
  })
})

describe('formatNoActiveSessions', () => {
  it('shows no sessions message when no recent runs', () => {
    const output = formatNoActiveSessions([])
    expect(output).toContain('No active pipeline sessions.')
    expect(output).not.toContain('Recent completed runs:')
  })

  it('shows recent completed runs with log directory paths', () => {
    const runs = [
      {runId: VALID_RUN_ID, logDir: `/project/.mat/logs/${VALID_RUN_ID}`},
      {runId: '660e8400-e29b-41d4-a716-446655440001', logDir: '/project/.mat/logs/660e8400-e29b-41d4-a716-446655440001'},
    ]

    const output = formatNoActiveSessions(runs)
    expect(output).toContain('No active pipeline sessions.')
    expect(output).toContain('Recent completed runs:')
    expect(output).toContain(VALID_RUN_ID)
    expect(output).toContain('660e8400-e29b-41d4-a716-446655440001')
    expect(output).toContain('Start a new session with: mat run --tmux')
  })

  it('includes log directory paths for each run', () => {
    const runs = [
      {runId: VALID_RUN_ID, logDir: `/project/.mat/logs/${VALID_RUN_ID}`},
    ]

    const output = formatNoActiveSessions(runs)
    expect(output).toContain(`→  /project/.mat/logs/${VALID_RUN_ID}`)
  })
})
