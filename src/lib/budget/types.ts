export type {BudgetRun, BudgetState} from '../schemas/budget-schema.js'

export interface BudgetCheckResult {
  ok: boolean
  warning?: string
}
