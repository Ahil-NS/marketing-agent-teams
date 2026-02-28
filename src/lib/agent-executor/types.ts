import type {z} from 'zod'

export interface AgentInput {
  /** The user prompt to send to the agent */
  prompt: string
  /** Optional structured context from upstream stages */
  context?: Record<string, unknown>
}

export interface BudgetConstraint {
  /** Maximum cost in USD for this execution */
  maxCostUsd: number
  /** Maximum number of conversation turns */
  maxTurns?: number
}

export interface AgentExecuteOptions {
  /** Agent name for logging and error reporting */
  agentName: string
  /** Parsed SKILL.md content used as system prompt */
  skillMd: string
  /** Typed input from upstream stage */
  input: AgentInput
  /** Model override (default from SKILL.md front matter) */
  model?: 'haiku' | 'sonnet'
  /** Tool permissions from SKILL.md */
  allowedTools?: string[]
  /** Per-agent budget limit */
  budget?: BudgetConstraint
  /** Zod schema for output validation */
  outputSchema?: z.ZodType
}

export interface AgentMessage {
  type: 'progress' | 'result'
  subtype?: 'success' | 'error_max_turns' | 'error_max_budget_usd' | 'error_during_execution'
  /** Final text output (only on result messages) */
  result?: string
  /** Cost in USD */
  totalCostUsd?: number
  /** Token usage */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  /** Number of conversation turns */
  numTurns?: number
  /** Wall time in milliseconds */
  durationMs?: number
  /** Error details (only on error result messages) */
  errors?: Array<{message: string}>
}

export interface CostEstimate {
  /** Estimated cost in USD */
  estimatedCostUsd: number
  /** Model used for the estimate */
  model: string
  /** Per-million-token input price used */
  inputPricePerMillion: number
  /** Per-million-token output price used */
  outputPricePerMillion: number
}
