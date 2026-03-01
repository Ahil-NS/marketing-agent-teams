import {execSync} from 'node:child_process'

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {PIPELINE_STAGES} from '../../../src/lib/orchestrator/types.js'
import {
  TmuxNotFoundError,
  TmuxSessionError,
  TmuxSessionManager,
  TmuxSessionNotFoundError,
  TMUX_NOT_FOUND,
  TMUX_SESSION_ERROR,
  TMUX_SESSION_NOT_FOUND,
} from '../../../src/lib/tmux/session-manager.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const mockExecSync = vi.mocked(execSync)

const VALID_RUN_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('TmuxSessionManager', () => {
  let manager: TmuxSessionManager

  beforeEach(() => {
    manager = new TmuxSessionManager()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==================================================================
  // Task 5.1: Test tmux detection (mock which command)
  // ==================================================================
  describe('isAvailable()', () => {
    it('returns true when tmux is installed', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      expect(TmuxSessionManager.isAvailable()).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith('which tmux', {stdio: 'pipe'})
    })

    it('returns false when tmux is not installed', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('not found')
      })
      expect(TmuxSessionManager.isAvailable()).toBe(false)
    })
  })

  // ==================================================================
  // Task 5.2: Test session creation, list, destroy lifecycle
  // ==================================================================
  describe('create()', () => {
    it('creates a tmux session with 7 panes for pipeline stages', () => {
      // isAvailable check
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // new-session
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // split-window × 6 (PIPELINE_STAGES.length - 1)
      for (let i = 1; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // select-layout tiled
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // select-pane title × 7
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // display-message for width check
      mockExecSync.mockReturnValueOnce(Buffer.from('200'))

      const sessionName = manager.create(VALID_RUN_ID)

      expect(sessionName).toBe(`mat-${VALID_RUN_ID}`)
      // Verify new-session call
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux new-session -d -s mat-${VALID_RUN_ID}`,
        {stdio: 'pipe'},
      )
      // Verify layout call
      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux select-layout -t mat-${VALID_RUN_ID} tiled`,
        {stdio: 'pipe'},
      )
    })

    it('throws TmuxNotFoundError when tmux is not available', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('not found')
      })

      expect(() => manager.create(VALID_RUN_ID)).toThrow(TmuxNotFoundError)
    })

    it('throws on invalid run ID', () => {
      expect(() => manager.create('invalid-id')).toThrow('Invalid run ID format')
    })

    it('throws TmuxSessionError on session creation failure', () => {
      // isAvailable succeeds
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // new-session fails
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('duplicate session')
      })
      // cleanup attempt (kill-session) — may throw, best-effort
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('no session')
      })

      expect(() => manager.create(VALID_RUN_ID)).toThrow(TmuxSessionError)
    })

    it('warns on narrow terminal width', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      // isAvailable
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // new-session
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // split-window × 6
      for (let i = 1; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // select-layout
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // select-pane × 7
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // display-message returns narrow width
      mockExecSync.mockReturnValueOnce('80\n')

      manager.create(VALID_RUN_ID)

      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('below recommended minimum'),
      )
      stderrSpy.mockRestore()
    })
  })

  describe('destroy()', () => {
    it('destroys an existing session', () => {
      // has-session succeeds (session exists)
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // kill-session succeeds
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      manager.destroy(VALID_RUN_ID)

      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux kill-session -t mat-${VALID_RUN_ID}`,
        {stdio: 'pipe'},
      )
    })

    it('throws TmuxSessionNotFoundError for non-existent session', () => {
      // has-session fails → not found
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('no session')
      })

      expect(() => manager.destroy(VALID_RUN_ID)).toThrow(TmuxSessionNotFoundError)
    })

    it('throws on invalid run ID', () => {
      expect(() => manager.destroy('bad')).toThrow('Invalid run ID format')
    })
  })

  describe('list()', () => {
    it('returns run IDs from active mat- sessions', () => {
      // isAvailable
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // list-sessions
      const id1 = '550e8400-e29b-41d4-a716-446655440001'
      const id2 = '550e8400-e29b-41d4-a716-446655440002'
      mockExecSync.mockReturnValueOnce(`mat-${id1}\nmat-${id2}\nother-session\n`)

      const result = manager.list()

      expect(result).toEqual([id1, id2])
    })

    it('returns empty array when tmux is not available', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('not found')
      })

      expect(manager.list()).toEqual([])
    })

    it('returns empty array when tmux server is not running', () => {
      // isAvailable
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // list-sessions fails (no server)
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('no server')
      })

      expect(manager.list()).toEqual([])
    })
  })

  describe('attach()', () => {
    it('attaches to an existing session', () => {
      // has-session succeeds
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // attach-session succeeds
      mockExecSync.mockReturnValueOnce(Buffer.from(''))

      manager.attach(VALID_RUN_ID)

      expect(mockExecSync).toHaveBeenCalledWith(
        `tmux attach-session -t mat-${VALID_RUN_ID}`,
        {stdio: 'inherit'},
      )
    })

    it('throws TmuxSessionNotFoundError for non-existent session', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('no session')
      })

      expect(() => manager.attach(VALID_RUN_ID)).toThrow(TmuxSessionNotFoundError)
    })
  })

  describe('detach()', () => {
    it('detaches from current session', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      manager.detach()
      expect(mockExecSync).toHaveBeenCalledWith('tmux detach-client', {stdio: 'pipe'})
    })

    it('throws TmuxSessionError on failure', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('no client')
      })

      expect(() => manager.detach()).toThrow(TmuxSessionError)
    })
  })

  // ==================================================================
  // Task 5.3: Test graceful fallback when tmux not available
  // ==================================================================
  describe('graceful fallback', () => {
    it('TmuxNotFoundError has correct error code', () => {
      const error = new TmuxNotFoundError()
      expect(error.code).toBe(TMUX_NOT_FOUND)
      expect(error.severity).toBe('permanent')
      expect(error.message).toContain('falling back to standard output')
    })

    it('TmuxSessionError has correct error code', () => {
      const error = new TmuxSessionError('test', 'reason')
      expect(error.code).toBe(TMUX_SESSION_ERROR)
      expect(error.severity).toBe('transient')
    })

    it('TmuxSessionNotFoundError has correct error code', () => {
      const error = new TmuxSessionNotFoundError('mat-abc')
      expect(error.code).toBe(TMUX_SESSION_NOT_FOUND)
      expect(error.severity).toBe('permanent')
    })
  })

  // ==================================================================
  // Task 5.4: Test run-id validation (reuse validateRunId)
  // ==================================================================
  describe('run-id validation', () => {
    it('rejects non-UUID run IDs on create', () => {
      expect(() => manager.create('not-a-uuid')).toThrow('Invalid run ID format')
    })

    it('rejects non-UUID run IDs on destroy', () => {
      expect(() => manager.destroy('../path-traversal')).toThrow('Invalid run ID format')
    })

    it('rejects non-UUID run IDs on attach', () => {
      expect(() => manager.attach('rm -rf /')).toThrow('Invalid run ID format')
    })

    it('accepts valid UUID v4 run IDs', () => {
      // isAvailable
      mockExecSync.mockReturnValueOnce(Buffer.from('/usr/bin/tmux'))
      // new-session
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // splits
      for (let i = 1; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // layout
      mockExecSync.mockReturnValueOnce(Buffer.from(''))
      // pane titles
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        mockExecSync.mockReturnValueOnce(Buffer.from(''))
      }
      // width check
      mockExecSync.mockReturnValueOnce(Buffer.from('200'))

      expect(() => manager.create(VALID_RUN_ID)).not.toThrow()
    })
  })
})
