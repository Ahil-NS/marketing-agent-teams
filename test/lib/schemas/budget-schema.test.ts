import {describe, expect, it} from 'vitest'

import {
  budgetCheckResultSchema,
  budgetConfigSchema,
  dailyBudgetEntrySchema,
  dailyBudgetStateSchema,
} from '../../../src/lib/schemas/budget-schema.js'

describe('budget-schema', () => {
  describe('dailyBudgetEntrySchema', () => {
    it('validates a valid entry', () => {
      const entry = {
        agentName: 'trend-scout',
        cost: 0.0234,
        timestamp: '2026-02-28T10:15:30.000Z',
      }
      const result = dailyBudgetEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(entry)
      }
    })

    it('rejects empty agentName', () => {
      const entry = {agentName: '', cost: 0.05, timestamp: '2026-02-28T10:00:00.000Z'}
      const result = dailyBudgetEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })

    it('rejects negative cost', () => {
      const entry = {agentName: 'agent', cost: -1, timestamp: '2026-02-28T10:00:00.000Z'}
      const result = dailyBudgetEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })

    it('rejects invalid timestamp', () => {
      const entry = {agentName: 'agent', cost: 0.05, timestamp: 'not-a-date'}
      const result = dailyBudgetEntrySchema.safeParse(entry)
      expect(result.success).toBe(false)
    })

    it('allows zero cost', () => {
      const entry = {agentName: 'agent', cost: 0, timestamp: '2026-02-28T10:00:00.000Z'}
      const result = dailyBudgetEntrySchema.safeParse(entry)
      expect(result.success).toBe(true)
    })
  })

  describe('dailyBudgetStateSchema', () => {
    it('validates a valid daily state', () => {
      const state = {
        date: '2026-02-28',
        spent: 2.4513,
        entries: [
          {agentName: 'trend-scout', cost: 0.0234, timestamp: '2026-02-28T10:15:30.000Z'},
        ],
      }
      const result = dailyBudgetStateSchema.safeParse(state)
      expect(result.success).toBe(true)
    })

    it('validates empty entries array', () => {
      const state = {date: '2026-03-01', spent: 0, entries: []}
      const result = dailyBudgetStateSchema.safeParse(state)
      expect(result.success).toBe(true)
    })

    it('rejects invalid date format', () => {
      const state = {date: '28-02-2026', spent: 0, entries: []}
      const result = dailyBudgetStateSchema.safeParse(state)
      expect(result.success).toBe(false)
    })

    it('rejects negative spent', () => {
      const state = {date: '2026-02-28', spent: -1, entries: []}
      const result = dailyBudgetStateSchema.safeParse(state)
      expect(result.success).toBe(false)
    })

    it('rejects missing fields', () => {
      const result = dailyBudgetStateSchema.safeParse({date: '2026-02-28'})
      expect(result.success).toBe(false)
    })
  })

  describe('budgetConfigSchema', () => {
    it('validates config with both limits', () => {
      const config = {perRunLimit: 5.0, perDayLimit: 10.0}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('validates config with null limits', () => {
      const config = {perRunLimit: null, perDayLimit: null}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('validates empty config (no limits)', () => {
      const config = {}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('validates config with only perRunLimit', () => {
      const config = {perRunLimit: 2.5}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('rejects negative perRunLimit', () => {
      const config = {perRunLimit: -1}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('rejects negative perDayLimit', () => {
      const config = {perDayLimit: -5}
      const result = budgetConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })
  })

  describe('budgetCheckResultSchema', () => {
    it('validates non-exceeded result', () => {
      const result = budgetCheckResultSchema.safeParse({
        exceeded: false,
        type: null,
        spent: 0.5,
        limit: 1.0,
        remaining: 0.5,
      })
      expect(result.success).toBe(true)
    })

    it('validates exceeded per-run result', () => {
      const result = budgetCheckResultSchema.safeParse({
        exceeded: true,
        type: 'per-run',
        spent: 1.01,
        limit: 1.0,
        remaining: 0,
      })
      expect(result.success).toBe(true)
    })

    it('validates exceeded per-day result', () => {
      const result = budgetCheckResultSchema.safeParse({
        exceeded: true,
        type: 'per-day',
        spent: 10.5,
        limit: 10.0,
        remaining: 0,
      })
      expect(result.success).toBe(true)
    })

    it('validates result with null remaining and null limit', () => {
      const result = budgetCheckResultSchema.safeParse({
        exceeded: false,
        type: null,
        spent: 0.5,
        limit: null,
        remaining: null,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid type value', () => {
      const result = budgetCheckResultSchema.safeParse({
        exceeded: true,
        type: 'per-agent',
        spent: 1.0,
        limit: 1.0,
        remaining: 0,
      })
      expect(result.success).toBe(false)
    })
  })
})
