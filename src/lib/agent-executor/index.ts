import type {AgentExecuteOptions, AgentMessage, CostEstimate} from './types.js'

export interface AgentExecutor {
  /**
   * Execute an agent with the given options.
   * Returns an async iterable of messages from the AI provider.
   * The final message with type 'result' contains the agent's output.
   */
  execute(options: AgentExecuteOptions): AsyncIterable<AgentMessage>

  /**
   * Estimate the cost of an agent execution before running it.
   * Used by budget tracking (Story 2.6) to pre-check affordability.
   */
  estimateCost(model: string, estimatedInputTokens: number): CostEstimate
}

export {createAgentExecutor, ClaudeAgentExecutor} from './claude-agent-executor.js'
export type {
  AgentExecuteOptions,
  AgentInput,
  AgentMessage,
  BudgetConstraint,
  CostEstimate,
} from './types.js'
export {
  AgentExecutionError,
  AgentTimeoutError,
  AgentValidationError,
  AgentBudgetExceededError,
  AgentNoResultError,
  AgentAuthError,
  AGENT_EXECUTION_FAILED,
  AGENT_TIMEOUT,
  AGENT_BUDGET_EXCEEDED,
  AGENT_VALIDATION_FAILED,
  AGENT_NO_RESULT,
  AGENT_AUTH_FAILED,
} from './errors.js'
