import {z} from 'zod'

// ============================================================
// Prerun Budget State (Story 1.7)
// ============================================================

export const budgetRunSchema = z.object({
  runId: z.string(),
  cost: z.number().nonnegative(),
  timestamp: z.string(),
})

export const budgetStateSchema = z.object({
  dailySpend: z.number().nonnegative().default(0),
  lastResetDate: z.string().default(''),
  runs: z.array(budgetRunSchema).default([]),
})

export type BudgetRun = z.infer<typeof budgetRunSchema>
export type BudgetState = z.infer<typeof budgetStateSchema>

// ============================================================
// Budget Tracking Schemas (Story 2.6)
// ============================================================

export const dailyBudgetEntrySchema = z.object({
  agentName: z.string().min(1),
  cost: z.number().min(0),
  timestamp: z.string().datetime(),
})

export const dailyBudgetStateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spent: z.number().min(0),
  entries: z.array(dailyBudgetEntrySchema),
})

export const budgetConfigSchema = z.object({
  perRunLimit: z.number().min(0).nullable().optional(),
  perDayLimit: z.number().min(0).nullable().optional(),
})

export const budgetCheckResultSchema = z.object({
  exceeded: z.boolean(),
  type: z.enum(['per-run', 'per-day']).nullable(),
  spent: z.number().min(0),
  limit: z.number().min(0).nullable(),
  remaining: z.number().min(0).nullable(),
})

export type DailyBudgetEntry = z.infer<typeof dailyBudgetEntrySchema>
export type DailyBudgetState = z.infer<typeof dailyBudgetStateSchema>
export type BudgetConfig = z.infer<typeof budgetConfigSchema>
export type BudgetCheckResult = z.infer<typeof budgetCheckResultSchema>
