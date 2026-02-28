import {MATError} from '../utils/errors.js'

export const BUDGET_EXCEEDED = 'BUDGET_EXCEEDED'

export class BudgetExceededError extends MATError {
  constructor(limit: number, spent: number) {
    super(
      `Daily budget limit reached: $${spent.toFixed(2)} spent of $${limit.toFixed(2)} limit`,
      BUDGET_EXCEEDED,
      `Daily budget limit reached: $${spent.toFixed(2)} spent of $${limit.toFixed(2)} limit`,
      `Wait until tomorrow for budget reset, or increase limit via 'mat config'`,
      'budget/budget-checker',
      'transient',
    )
  }
}
