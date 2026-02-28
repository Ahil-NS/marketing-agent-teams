import {query} from '@anthropic-ai/claude-agent-sdk'

import type {AgentExecutor} from './index.js'
import type {AgentExecuteOptions, AgentMessage, CostEstimate} from './types.js'
import {
  AgentExecutionError,
  AgentTimeoutError,
  AgentBudgetExceededError,
  AgentNoResultError,
  AgentAuthError,
} from './errors.js'

/** Claude model pricing per million tokens (as of SDK 0.2.63) */
const CLAUDE_PRICING: Record<string, {input: number; output: number}> = {
  haiku: {input: 0.25, output: 1.25},
  sonnet: {input: 3.0, output: 15.0},
}

export class ClaudeAgentExecutor implements AgentExecutor {
  async *execute(options: AgentExecuteOptions): AsyncIterable<AgentMessage> {
    const queryOptions: Record<string, unknown> = {
      systemPrompt: options.skillMd,
      allowedTools: options.allowedTools ?? [],
      model: options.model ?? 'sonnet',
      maxTurns: options.budget?.maxTurns ?? 15,
      permissionMode: 'bypassPermissions',
    }

    if (options.budget?.maxCostUsd !== undefined && Number.isFinite(options.budget.maxCostUsd)) {
      queryOptions.maxBudgetUsd = options.budget.maxCostUsd
    }

    let hasResult = false

    try {
      for await (const message of query({
        prompt: options.input.prompt,
        options: queryOptions,
      })) {
        if (message.type === 'result') {
          hasResult = true

          if (message.subtype === 'success') {
            yield {
              type: 'result',
              subtype: 'success',
              result: message.result,
              totalCostUsd: message.total_cost_usd,
              usage: message.usage
                ? {
                    inputTokens: message.usage.input_tokens ?? 0,
                    outputTokens: message.usage.output_tokens ?? 0,
                  }
                : undefined,
              numTurns: message.num_turns,
              durationMs: message.duration_ms,
            }
            return
          }

          if (message.subtype === 'error_max_turns') {
            throw new AgentTimeoutError(
              `Agent '${options.agentName}' exceeded maximum turns`,
              'AGENT_TIMEOUT',
              `Agent '${options.agentName}' hit the ${queryOptions.maxTurns}-turn limit without producing a final result`,
              'Increase maxTurns in the agent budget configuration, or simplify the agent task',
              'agent-executor/claude',
              'transient',
            )
          }

          if (message.subtype === 'error_max_budget_usd') {
            throw new AgentBudgetExceededError(
              `Agent '${options.agentName}' exceeded budget`,
              'AGENT_BUDGET_EXCEEDED',
              `Agent '${options.agentName}' exceeded its budget limit of $${options.budget?.maxCostUsd ?? 'unknown'} (actual: $${message.total_cost_usd ?? 'unknown'})`,
              'Increase the per-agent budget in config, or use a cheaper model (haiku instead of sonnet)',
              'agent-executor/claude',
              'permanent',
            )
          }

          if (message.subtype === 'error_during_execution') {
            const errorDetails =
              message.errors?.join('; ') ?? 'Unknown error'
            throw new AgentExecutionError(
              `Agent '${options.agentName}' failed during execution`,
              'AGENT_EXECUTION_FAILED',
              `Agent SDK reported an execution error: ${errorDetails}`,
              'Check the agent logs for details. If persistent, verify Claude Code CLI authentication and network connectivity',
              'agent-executor/claude',
              'transient',
            )
          }
        }
      }
    } catch (error) {
      if (
        error instanceof AgentExecutionError ||
        error instanceof AgentTimeoutError ||
        error instanceof AgentBudgetExceededError
      ) {
        throw error
      }

      // Wrap unknown errors
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
        throw new AgentAuthError(
          `Authentication failed for agent '${options.agentName}'`,
          'AGENT_AUTH_FAILED',
          `Claude Code CLI authentication failed or expired: ${errorMessage}`,
          'Run `claude login` to re-authenticate, then retry the pipeline',
          'agent-executor/claude',
          'permanent',
        )
      }

      throw new AgentExecutionError(
        `Agent '${options.agentName}' failed: ${errorMessage}`,
        'AGENT_EXECUTION_FAILED',
        `Unexpected error during agent execution: ${errorMessage}`,
        'Check network connectivity and Claude Code CLI authentication. Retry if transient.',
        'agent-executor/claude',
        'transient',
      )
    }

    if (!hasResult) {
      throw new AgentNoResultError(
        `Agent '${options.agentName}' completed without producing a result`,
        'AGENT_NO_RESULT',
        'The Agent SDK query() loop completed but no result message was emitted',
        'This is likely an SDK bug. Check Claude Agent SDK version (expected: 0.2.63) and retry',
        'agent-executor/claude',
        'transient',
      )
    }
  }

  estimateCost(model: string, estimatedInputTokens: number): CostEstimate {
    const pricing = CLAUDE_PRICING[model] ?? CLAUDE_PRICING['sonnet']
    // Estimate output at 25% of input tokens as a rough heuristic
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.25)

    return {
      estimatedCostUsd:
        (estimatedInputTokens / 1_000_000) * pricing.input +
        (estimatedOutputTokens / 1_000_000) * pricing.output,
      model,
      inputPricePerMillion: pricing.input,
      outputPricePerMillion: pricing.output,
    }
  }
}

/**
 * Factory function to create an AgentExecutor instance.
 * MVP: always returns ClaudeAgentExecutor.
 * Wave 2: will accept a provider parameter to select the implementation.
 */
export function createAgentExecutor(_provider?: string): AgentExecutor {
  // MVP: Claude is the only provider. The _provider param is reserved
  // for Wave 2 multi-provider support. Underscore prefix signals unused.
  return new ClaudeAgentExecutor()
}
