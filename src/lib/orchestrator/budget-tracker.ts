import {existsSync} from 'node:fs'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'

import {dailyBudgetStateSchema} from '../schemas/budget-schema.js'

import {BudgetStateCorruptError, BudgetValidationError} from './errors.js'
import type {BudgetCheckResult, BudgetConfig, BudgetState, DailyBudgetState} from './types.js'

export class BudgetTracker {
  private runSpend = 0
  private dailyState: DailyBudgetState = {
    date: new Date().toISOString().slice(0, 10),
    spent: 0,
    entries: [],
  }

  private readonly perRunLimit: number | null
  private readonly perDayLimit: number | null

  constructor(config: BudgetConfig) {
    this.perRunLimit = config.perRunLimit ?? null
    this.perDayLimit = config.perDayLimit ?? null
  }

  /**
   * Record cost from a completed agent execution.
   * Returns whether any budget limit was exceeded.
   */
  recordCost(agentName: string, cost: number): BudgetCheckResult {
    if (!agentName || agentName.trim() === '') {
      throw new BudgetValidationError('agentName must be a non-empty string')
    }

    if (cost < 0) {
      throw new BudgetValidationError('Cost cannot be negative')
    }

    this.runSpend += cost
    this.dailyState.spent += cost
    this.dailyState.entries.push({
      agentName,
      cost,
      timestamp: new Date().toISOString(),
    })

    return this.checkBudget()
  }

  /**
   * Check whether current spend exceeds any configured budget limit.
   */
  checkBudget(): BudgetCheckResult {
    // Check per-run limit
    if (this.perRunLimit !== null && this.runSpend >= this.perRunLimit) {
      return {
        exceeded: true,
        type: 'per-run',
        spent: this.runSpend,
        limit: this.perRunLimit,
        remaining: 0,
      }
    }

    // Check per-day limit
    if (this.perDayLimit !== null && this.dailyState.spent >= this.perDayLimit) {
      return {
        exceeded: true,
        type: 'per-day',
        spent: this.dailyState.spent,
        limit: this.perDayLimit,
        remaining: 0,
      }
    }

    // Calculate minimum remaining across all active limits
    const remainingRun = this.perRunLimit !== null
      ? this.perRunLimit - this.runSpend
      : Infinity
    const remainingDay = this.perDayLimit !== null
      ? this.perDayLimit - this.dailyState.spent
      : Infinity
    const remaining = Math.min(remainingRun, remainingDay)

    return {
      exceeded: false,
      type: null,
      spent: this.runSpend,
      limit: this.perRunLimit ?? this.perDayLimit ?? null,
      remaining: remaining === Infinity ? null : remaining,
    }
  }

  /**
   * Get total spend for the current pipeline run.
   */
  getRunSpend(): number {
    return this.runSpend
  }

  /**
   * Get serializable budget state for PipelineRun.budget.
   */
  getSnapshot(): BudgetState {
    return {
      spent: this.runSpend,
      limit: this.perRunLimit ?? 0,
      currency: 'USD',
      dailySpent: this.dailyState.spent,
      dailyLimit: this.perDayLimit ?? 0,
    }
  }

  /**
   * Load daily budget state from disk. Creates fresh state if missing.
   * Handles date rollover: resets if stored date is not today.
   */
  async loadDailyState(statePath: string): Promise<void> {
    const filePath = join(statePath, 'budget.json')

    if (!existsSync(filePath)) {
      this.dailyState = {
        date: new Date().toISOString().slice(0, 10),
        spent: 0,
        entries: [],
      }
      return
    }

    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      const result = dailyBudgetStateSchema.safeParse(parsed)

      if (!result.success) {
        throw new BudgetStateCorruptError(filePath, result.error.message)
      }

      const state = result.data
      const today = new Date().toISOString().slice(0, 10)

      // Date rollover: reset if not today
      if (state.date !== today) {
        this.dailyState = {
          date: today,
          spent: 0,
          entries: [],
        }
      } else {
        this.dailyState = state
      }
    } catch (error) {
      if (error instanceof BudgetStateCorruptError) {
        throw error
      }

      // Malformed JSON or file read error — treat as corruption
      throw new BudgetStateCorruptError(
        filePath,
        error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : String(error),
      )
    }
  }

  /**
   * Persist daily budget state to disk.
   */
  async saveDailyState(statePath: string): Promise<void> {
    const filePath = join(statePath, 'budget.json')
    const dir = dirname(filePath)

    if (!existsSync(dir)) {
      await mkdir(dir, {recursive: true})
    }

    await writeFile(filePath, JSON.stringify(this.dailyState, null, 2), 'utf-8')
  }
}
