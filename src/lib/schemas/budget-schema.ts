import {z} from 'zod'

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
