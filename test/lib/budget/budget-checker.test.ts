import {existsSync} from 'node:fs'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('budget-checker', () => {
  let projectRoot: string
  const DEFAULT_LIMIT = 10

  beforeEach(async () => {
    projectRoot = await createTestDir()
    // Create .mat directory structure (config no longer needed for budget checks)
    await mkdir(join(projectRoot, '.mat', 'state'), {recursive: true})
  })

  afterEach(async () => {
    await removeTestDir(projectRoot)
  })

  describe('checkBudget', () => {
    it('passes when daily spend is under limit', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 3, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const result = await checkBudget(projectRoot, DEFAULT_LIMIT)
      expect(result.ok).toBe(true)
      expect(result.warning).toBeUndefined()
    })

    it('throws BudgetExceededError when spend meets limit', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 10, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const {BudgetExceededError} = await import('../../../src/lib/budget/errors.js')
      await expect(checkBudget(projectRoot, DEFAULT_LIMIT)).rejects.toThrow(BudgetExceededError)
    })

    it('throws BudgetExceededError when spend exceeds limit', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 15, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const {BudgetExceededError} = await import('../../../src/lib/budget/errors.js')
      await expect(checkBudget(projectRoot, DEFAULT_LIMIT)).rejects.toThrow(BudgetExceededError)
    })

    it('returns warning when budget at 90%+', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 9.5, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const result = await checkBudget(projectRoot, DEFAULT_LIMIT)
      expect(result.ok).toBe(true)
      expect(result.warning).toContain('Approaching daily budget limit')
      expect(result.warning).toContain('$9.50')
      expect(result.warning).toContain('$10.00')
    })

    it('creates budget.json with zero spend if file missing', async () => {
      const budgetPath = join(projectRoot, '.mat', 'state', 'budget.json')
      expect(existsSync(budgetPath)).toBe(false)

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const result = await checkBudget(projectRoot, DEFAULT_LIMIT)
      expect(result.ok).toBe(true)

      expect(existsSync(budgetPath)).toBe(true)
      const written = JSON.parse(await readFile(budgetPath, 'utf-8'))
      expect(written.dailySpend).toBe(0)
    })

    it('resets daily spend when lastResetDate is not today', async () => {
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 8, lastResetDate: '2020-01-01', runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const result = await checkBudget(projectRoot, DEFAULT_LIMIT)
      expect(result.ok).toBe(true)
      // Spend was reset so no warning
      expect(result.warning).toBeUndefined()

      const written = JSON.parse(
        await readFile(join(projectRoot, '.mat', 'state', 'budget.json'), 'utf-8'),
      )
      expect(written.dailySpend).toBe(0)
    })

    it('handles corrupted budget.json by recreating with zero spend', async () => {
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        'not valid json!!!',
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const result = await checkBudget(projectRoot, DEFAULT_LIMIT)
      expect(result.ok).toBe(true)

      const written = JSON.parse(
        await readFile(join(projectRoot, '.mat', 'state', 'budget.json'), 'utf-8'),
      )
      expect(written.dailySpend).toBe(0)
    })

    it('uses default budget limit of 10 when no limit provided', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 11, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      const {BudgetExceededError} = await import('../../../src/lib/budget/errors.js')
      // No budgetLimit passed — should use default of 10
      await expect(checkBudget(projectRoot)).rejects.toThrow(BudgetExceededError)
    })

    it('respects custom budget limit when provided', async () => {
      const todayISO = new Date().toISOString().slice(0, 10)
      await writeFile(
        join(projectRoot, '.mat', 'state', 'budget.json'),
        JSON.stringify({dailySpend: 15, lastResetDate: todayISO, runs: []}),
        'utf-8',
      )

      const {checkBudget} = await import('../../../src/lib/budget/budget-checker.js')
      // Spend of 15 is under limit of 20
      const result = await checkBudget(projectRoot, 20)
      expect(result.ok).toBe(true)
    })

    it('BudgetExceededError has correct code and resolution', async () => {
      const {BudgetExceededError} = await import('../../../src/lib/budget/errors.js')
      const error = new BudgetExceededError(10, 12)
      expect(error.code).toBe('BUDGET_EXCEEDED')
      expect(error.message).toContain('$12.00')
      expect(error.message).toContain('$10.00')
      expect(error.resolution).toContain('mat config')
      expect(error.severity).toBe('transient')
    })
  })
})
