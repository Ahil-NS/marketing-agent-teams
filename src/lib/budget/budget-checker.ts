import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {budgetStateSchema} from '../schemas/budget-schema.js'

import {BudgetExceededError} from './errors.js'
import type {BudgetCheckResult, BudgetState} from './types.js'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function checkBudget(projectRoot: string, budgetLimit = 10): Promise<BudgetCheckResult> {
  const today = todayISO()
  const budgetPath = join(projectRoot, '.mat', 'state', 'budget.json')
  let state: BudgetState

  try {
    const raw = await readFile(budgetPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const result = budgetStateSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error('Invalid budget state')
    }

    state = result.data
  } catch {
    // First run, missing file, or corrupted — initialize
    state = {dailySpend: 0, lastResetDate: today, runs: []}
    await mkdir(join(projectRoot, '.mat', 'state'), {recursive: true})
    await writeFile(budgetPath, JSON.stringify(state, null, 2), 'utf-8')
  }

  // Reset daily spend if new day
  if (state.lastResetDate !== today) {
    state = {...state, dailySpend: 0, lastResetDate: today}
    await writeFile(budgetPath, JSON.stringify(state, null, 2), 'utf-8')
  }

  if (state.dailySpend >= budgetLimit) {
    throw new BudgetExceededError(budgetLimit, state.dailySpend)
  }

  const percentUsed = (state.dailySpend / budgetLimit) * 100
  return {
    ok: true,
    warning: percentUsed >= 90
      ? `Approaching daily budget limit ($${state.dailySpend.toFixed(2)}/$${budgetLimit.toFixed(2)})`
      : undefined,
  }
}
