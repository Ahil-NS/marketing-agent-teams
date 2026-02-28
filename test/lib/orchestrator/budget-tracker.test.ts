import {existsSync} from 'node:fs'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BudgetTracker} from '../../../src/lib/orchestrator/budget-tracker.js'
import {BudgetStateCorruptError, BudgetValidationError} from '../../../src/lib/orchestrator/errors.js'

describe('BudgetTracker', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `mat-budget-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(tempDir, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, {recursive: true, force: true})
    }
  })

  // ============================================================
  // Constructor & Basic State
  // ============================================================

  describe('constructor', () => {
    it('initializes with no limits (AC3)', () => {
      const tracker = new BudgetTracker({})
      expect(tracker.getRunSpend()).toBe(0)

      const snapshot = tracker.getSnapshot()
      expect(snapshot.spent).toBe(0)
      expect(snapshot.limit).toBe(0)
      expect(snapshot.currency).toBe('USD')
      expect(snapshot.dailySpent).toBe(0)
      expect(snapshot.dailyLimit).toBe(0)
    })

    it('initializes with perRunLimit only', () => {
      const tracker = new BudgetTracker({perRunLimit: 5.0})
      const snapshot = tracker.getSnapshot()
      expect(snapshot.limit).toBe(5.0)
      expect(snapshot.dailyLimit).toBe(0)
    })

    it('initializes with perDayLimit only', () => {
      const tracker = new BudgetTracker({perDayLimit: 10.0})
      const snapshot = tracker.getSnapshot()
      expect(snapshot.limit).toBe(0)
      expect(snapshot.dailyLimit).toBe(10.0)
    })

    it('initializes with both limits', () => {
      const tracker = new BudgetTracker({perRunLimit: 2.0, perDayLimit: 10.0})
      const snapshot = tracker.getSnapshot()
      expect(snapshot.limit).toBe(2.0)
      expect(snapshot.dailyLimit).toBe(10.0)
    })

    it('treats null limits as no limit', () => {
      const tracker = new BudgetTracker({perRunLimit: null, perDayLimit: null})
      const check = tracker.checkBudget()
      expect(check.exceeded).toBe(false)
      expect(check.remaining).toBeNull()
    })
  })

  // ============================================================
  // recordCost (AC1)
  // ============================================================

  describe('recordCost', () => {
    it('accumulates cost from a single agent', () => {
      const tracker = new BudgetTracker({perRunLimit: 5.0})
      tracker.recordCost('trend-scout', 0.0234)
      expect(tracker.getRunSpend()).toBeCloseTo(0.0234)
    })

    it('accumulates cost from multiple agents', () => {
      const tracker = new BudgetTracker({perRunLimit: 5.0})
      tracker.recordCost('trend-scout', 0.0234)
      tracker.recordCost('competitor-analyst', 0.0456)
      tracker.recordCost('campaign-strategist', 0.1823)
      tracker.recordCost('content-creator', 0.05)
      tracker.recordCost('optimizer', 0.1)
      expect(tracker.getRunSpend()).toBeCloseTo(0.4013)
    })

    it('returns BudgetCheckResult after recording', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      const result = tracker.recordCost('agent-a', 0.5)
      expect(result.exceeded).toBe(false)
      expect(result.spent).toBeCloseTo(0.5)
      expect(result.remaining).toBeCloseTo(0.5)
    })

    it('allows zero cost without error', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      const result = tracker.recordCost('agent-a', 0)
      expect(result.exceeded).toBe(false)
      expect(tracker.getRunSpend()).toBe(0)
    })

    it('throws BudgetValidationError on negative cost', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      expect(() => tracker.recordCost('agent-a', -1)).toThrow(BudgetValidationError)
      expect(() => tracker.recordCost('agent-a', -1)).toThrow('Cost cannot be negative')
    })

    it('throws BudgetValidationError on empty agentName', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      expect(() => tracker.recordCost('', 0.5)).toThrow(BudgetValidationError)
      expect(() => tracker.recordCost('', 0.5)).toThrow('agentName must be a non-empty string')
    })

    it('throws BudgetValidationError on whitespace-only agentName', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      expect(() => tracker.recordCost('   ', 0.5)).toThrow(BudgetValidationError)
    })
  })

  // ============================================================
  // Per-Run Budget Enforcement (AC2)
  // ============================================================

  describe('per-run budget limit', () => {
    it('detects when per-run limit is exceeded', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      tracker.recordCost('agent-a', 0.6)
      const result = tracker.recordCost('agent-b', 0.5)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-run')
      expect(result.spent).toBeCloseTo(1.1)
      expect(result.limit).toBe(1.0)
      expect(result.remaining).toBe(0)
    })

    it('detects exact boundary (>= check)', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0})
      const result = tracker.recordCost('agent-a', 1.0)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-run')
      expect(result.remaining).toBe(0)
    })

    it('returns remaining budget when under limit', () => {
      const tracker = new BudgetTracker({perRunLimit: 2.0})
      tracker.recordCost('agent-a', 0.5)
      const check = tracker.checkBudget()
      expect(check.exceeded).toBe(false)
      expect(check.remaining).toBeCloseTo(1.5)
    })
  })

  // ============================================================
  // Per-Day Budget Enforcement (AC2)
  // ============================================================

  describe('per-day budget limit', () => {
    it('detects when daily limit is exceeded', () => {
      const tracker = new BudgetTracker({perDayLimit: 10.0})
      tracker.recordCost('agent-a', 6.0)
      const result = tracker.recordCost('agent-b', 5.0)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-day')
      expect(result.limit).toBe(10.0)
    })

    it('per-day limit takes precedence when both are set and daily is hit first', () => {
      const tracker = new BudgetTracker({perRunLimit: 20.0, perDayLimit: 5.0})
      const result = tracker.recordCost('agent-a', 5.0)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-day')
    })

    it('per-run limit takes precedence when it is hit first', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0, perDayLimit: 10.0})
      const result = tracker.recordCost('agent-a', 1.0)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-run')
    })

    it('accounts for pre-existing daily spend', async () => {
      // Write pre-existing daily state
      const today = new Date().toISOString().slice(0, 10)
      const stateDir = join(tempDir, 'state')
      await mkdir(stateDir, {recursive: true})
      await writeFile(
        join(stateDir, 'budget.json'),
        JSON.stringify({
          date: today,
          spent: 8.0,
          entries: [{agentName: 'prior-agent', cost: 8.0, timestamp: new Date().toISOString()}],
        }),
        'utf-8',
      )

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      await tracker.loadDailyState(stateDir)

      // Adding 3.0 should exceed 10.0 daily limit (8.0 + 3.0 = 11.0)
      const result = tracker.recordCost('agent-a', 3.0)
      expect(result.exceeded).toBe(true)
      expect(result.type).toBe('per-day')
    })
  })

  // ============================================================
  // No-Limit Default Behavior (AC3)
  // ============================================================

  describe('no-limit mode (AC3)', () => {
    it('operates without cost restrictions when no limits configured', () => {
      const tracker = new BudgetTracker({})
      tracker.recordCost('agent-a', 100)
      tracker.recordCost('agent-b', 200)
      const check = tracker.checkBudget()
      expect(check.exceeded).toBe(false)
      expect(check.remaining).toBeNull()
      expect(check.limit).toBeNull()
    })

    it('still accumulates cost for reporting', () => {
      const tracker = new BudgetTracker({})
      tracker.recordCost('agent-a', 1.5)
      tracker.recordCost('agent-b', 2.3)
      expect(tracker.getRunSpend()).toBeCloseTo(3.8)
    })
  })

  // ============================================================
  // getSnapshot
  // ============================================================

  describe('getSnapshot', () => {
    it('returns accurate state after recording costs', () => {
      const tracker = new BudgetTracker({perRunLimit: 5.0, perDayLimit: 10.0})
      tracker.recordCost('trend-scout', 0.5)
      tracker.recordCost('competitor-analyst', 0.3)

      const snapshot = tracker.getSnapshot()
      expect(snapshot.spent).toBeCloseTo(0.8)
      expect(snapshot.limit).toBe(5.0)
      expect(snapshot.currency).toBe('USD')
      expect(snapshot.dailySpent).toBeCloseTo(0.8)
      expect(snapshot.dailyLimit).toBe(10.0)
    })

    it('returns zero snapshot on fresh tracker', () => {
      const tracker = new BudgetTracker({perRunLimit: 1.0, perDayLimit: 5.0})
      const snapshot = tracker.getSnapshot()
      expect(snapshot.spent).toBe(0)
      expect(snapshot.dailySpent).toBe(0)
    })
  })

  // ============================================================
  // Daily State Persistence
  // ============================================================

  describe('loadDailyState', () => {
    it('creates fresh state when file is missing', async () => {
      const tracker = new BudgetTracker({perDayLimit: 10.0})
      const stateDir = join(tempDir, 'nonexistent')

      await tracker.loadDailyState(stateDir)

      const snapshot = tracker.getSnapshot()
      expect(snapshot.dailySpent).toBe(0)
    })

    it('loads existing state for today', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const stateDir = join(tempDir, 'state')
      await mkdir(stateDir, {recursive: true})
      await writeFile(
        join(stateDir, 'budget.json'),
        JSON.stringify({
          date: today,
          spent: 3.5,
          entries: [{agentName: 'prior', cost: 3.5, timestamp: new Date().toISOString()}],
        }),
        'utf-8',
      )

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      await tracker.loadDailyState(stateDir)

      const snapshot = tracker.getSnapshot()
      expect(snapshot.dailySpent).toBeCloseTo(3.5)
    })

    it('resets daily state on date rollover', async () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      const stateDir = join(tempDir, 'state')
      await mkdir(stateDir, {recursive: true})
      await writeFile(
        join(stateDir, 'budget.json'),
        JSON.stringify({
          date: yesterday,
          spent: 9.99,
          entries: [{agentName: 'old-agent', cost: 9.99, timestamp: '2026-02-27T23:59:59.000Z'}],
        }),
        'utf-8',
      )

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      await tracker.loadDailyState(stateDir)

      const snapshot = tracker.getSnapshot()
      expect(snapshot.dailySpent).toBe(0)
    })

    it('throws BudgetStateCorruptError on invalid JSON schema', async () => {
      const stateDir = join(tempDir, 'state')
      await mkdir(stateDir, {recursive: true})
      await writeFile(
        join(stateDir, 'budget.json'),
        JSON.stringify({date: '2026-02-28', spent: 'not-a-number', entries: []}),
        'utf-8',
      )

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      await expect(tracker.loadDailyState(stateDir)).rejects.toThrow(BudgetStateCorruptError)
    })

    it('throws BudgetStateCorruptError on malformed JSON', async () => {
      const stateDir = join(tempDir, 'state')
      await mkdir(stateDir, {recursive: true})
      await writeFile(join(stateDir, 'budget.json'), '{invalid json', 'utf-8')

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      await expect(tracker.loadDailyState(stateDir)).rejects.toThrow(BudgetStateCorruptError)
    })
  })

  describe('saveDailyState', () => {
    it('persists state to disk', async () => {
      const stateDir = join(tempDir, 'state')

      const tracker = new BudgetTracker({perDayLimit: 10.0})
      tracker.recordCost('agent-a', 1.5)
      tracker.recordCost('agent-b', 0.3)

      await tracker.saveDailyState(stateDir)

      const filePath = join(stateDir, 'budget.json')
      expect(existsSync(filePath)).toBe(true)

      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.spent).toBeCloseTo(1.8)
      expect(parsed.entries).toHaveLength(2)
      expect(parsed.entries[0].agentName).toBe('agent-a')
      expect(parsed.entries[1].agentName).toBe('agent-b')
    })

    it('creates directory if missing', async () => {
      const stateDir = join(tempDir, 'nested', 'deep', 'state')

      const tracker = new BudgetTracker({})
      tracker.recordCost('agent-a', 0.1)
      await tracker.saveDailyState(stateDir)

      expect(existsSync(join(stateDir, 'budget.json'))).toBe(true)
    })
  })

  // ============================================================
  // State Persistence Roundtrip
  // ============================================================

  describe('state persistence roundtrip', () => {
    it('save then load produces matching state', async () => {
      const stateDir = join(tempDir, 'state')

      const tracker1 = new BudgetTracker({perDayLimit: 10.0})
      tracker1.recordCost('agent-x', 1.23)
      tracker1.recordCost('agent-y', 4.56)
      await tracker1.saveDailyState(stateDir)

      const tracker2 = new BudgetTracker({perDayLimit: 10.0})
      await tracker2.loadDailyState(stateDir)

      const snap1 = tracker1.getSnapshot()
      const snap2 = tracker2.getSnapshot()
      expect(snap2.dailySpent).toBeCloseTo(snap1.dailySpent)
    })

    it('accumulated run spend resets for new tracker but daily persists', async () => {
      const stateDir = join(tempDir, 'state')

      const tracker1 = new BudgetTracker({perRunLimit: 5.0, perDayLimit: 10.0})
      tracker1.recordCost('agent-a', 2.0)
      await tracker1.saveDailyState(stateDir)

      const tracker2 = new BudgetTracker({perRunLimit: 5.0, perDayLimit: 10.0})
      await tracker2.loadDailyState(stateDir)

      // Run spend is per-instance, starts at 0
      expect(tracker2.getRunSpend()).toBe(0)
      // Daily spend persists
      expect(tracker2.getSnapshot().dailySpent).toBeCloseTo(2.0)
    })
  })

  // ============================================================
  // checkBudget remaining calculation
  // ============================================================

  describe('checkBudget remaining calculation', () => {
    it('returns minimum of run and day remaining', () => {
      const tracker = new BudgetTracker({perRunLimit: 3.0, perDayLimit: 10.0})
      tracker.recordCost('agent-a', 1.0)

      const check = tracker.checkBudget()
      expect(check.exceeded).toBe(false)
      // perRun remaining = 2.0, perDay remaining = 9.0 → min = 2.0
      expect(check.remaining).toBeCloseTo(2.0)
    })

    it('returns null remaining when no limits set', () => {
      const tracker = new BudgetTracker({})
      tracker.recordCost('agent-a', 50)
      const check = tracker.checkBudget()
      expect(check.remaining).toBeNull()
    })
  })

  // ============================================================
  // Error Class Tests
  // ============================================================

  describe('error classes', () => {
    it('PipelineBudgetExceeded is an instance of Error', async () => {
      const {PipelineBudgetExceeded} = await import('../../../src/lib/orchestrator/errors.js')
      const err = new PipelineBudgetExceeded('per-run', 1.5, 1.0)
      expect(err).toBeInstanceOf(Error)
      expect(err.code).toBe('PIPELINE_BUDGET_EXCEEDED')
      expect(err.message).toContain('Per-run budget limit exceeded')
      expect(err.message).toContain('$1.5000')
      expect(err.message).toContain('$1.00')
      expect(err.resolution).toContain('Increase the budget limit')
    })

    it('PipelineBudgetExceeded daily uses DAILY_BUDGET_EXCEEDED code', async () => {
      const {PipelineBudgetExceeded} = await import('../../../src/lib/orchestrator/errors.js')
      const err = new PipelineBudgetExceeded('per-day', 10.5, 10.0)
      expect(err.code).toBe('DAILY_BUDGET_EXCEEDED')
      expect(err.message).toContain('Daily budget limit exceeded')
    })

    it('BudgetStateCorruptError has correct fields', () => {
      const err = new BudgetStateCorruptError('/path/to/budget.json', 'invalid field')
      expect(err.code).toBe('BUDGET_STATE_CORRUPT')
      expect(err.message).toContain('corrupt')
      expect(err.reason).toContain('budget.json')
      expect(err.resolution).toContain('Delete the file')
      expect(err.severity).toBe('transient')
    })

    it('BudgetValidationError has correct fields', () => {
      const err = new BudgetValidationError('Cost cannot be negative')
      expect(err.code).toBe('BUDGET_VALIDATION_ERROR')
      expect(err.message).toContain('validation error')
      expect(err.severity).toBe('permanent')
    })
  })

  // ============================================================
  // Concurrent Safety (M2)
  // ============================================================

  describe('concurrent safety', () => {
    it('two trackers saving to the same path — last write wins without corruption', async () => {
      const stateDir = join(tempDir, 'state')

      const tracker1 = new BudgetTracker({perDayLimit: 20.0})
      tracker1.recordCost('agent-a', 1.0)

      const tracker2 = new BudgetTracker({perDayLimit: 20.0})
      tracker2.recordCost('agent-b', 2.0)

      // Both save concurrently
      await Promise.all([
        tracker1.saveDailyState(stateDir),
        tracker2.saveDailyState(stateDir),
      ])

      // Verify the file is valid JSON and parseable (not corrupted)
      const raw = await readFile(join(stateDir, 'budget.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.date).toBeDefined()
      expect(parsed.entries).toBeDefined()
      expect(Array.isArray(parsed.entries)).toBe(true)
      // One of the two trackers won — either is acceptable, no corruption
      expect([1.0, 2.0]).toContain(parsed.spent)
    })
  })
})
