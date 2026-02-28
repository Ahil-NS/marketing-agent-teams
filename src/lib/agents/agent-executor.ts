import {query} from '@anthropic-ai/claude-agent-sdk'
import type {z} from 'zod'

import type {AgentResult} from './types.js'
import {AgentExecutionError, AgentTimeoutError, AgentValidationError} from './errors.js'

export interface AgentExecuteOptions<T> {
  prompt: string
  systemPrompt: string
  allowedTools: string[]
  model: 'haiku' | 'sonnet'
  outputSchema: z.ZodType<T>
  maxTurns?: number
  maxBudgetUsd?: number
}

export async function executeAgent<T>(
  agentName: string,
  options: AgentExecuteOptions<T>,
): Promise<AgentResult<T>> {
  const startTime = Date.now()

  for await (const message of query({
    prompt: options.prompt,
    options: {
      systemPrompt: options.systemPrompt,
      allowedTools: options.allowedTools,
      model: options.model,
      maxTurns: options.maxTurns ?? 15,
      // Agents run non-interactively in pipeline; tool calls are pre-authorized
      // by the agent's allowedTools list. Trust boundary enforced via allowedTools.
      permissionMode: 'bypassPermissions',
      ...(options.maxBudgetUsd !== undefined && {maxBudgetUsd: options.maxBudgetUsd}),
    },
  })) {
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        let jsonData: unknown
        try {
          jsonData = JSON.parse(message.result)
        } catch {
          throw new AgentValidationError(
            agentName,
            new Error(`Agent returned invalid JSON: ${message.result.slice(0, 200)}`),
          )
        }

        const parsed = options.outputSchema.safeParse(jsonData)
        if (!parsed.success) {
          throw new AgentValidationError(agentName, parsed.error)
        }
        return {
          agentName,
          status: 'success',
          outputs: parsed.data,
          usage: {
            inputTokens: message.usage?.input_tokens ?? 0,
            outputTokens: message.usage?.output_tokens ?? 0,
            cost: message.total_cost_usd ?? 0,
          },
          duration: Date.now() - startTime,
          errors: [],
        }
      }

      if (message.subtype === 'error_max_turns') {
        throw new AgentTimeoutError(agentName, 'Max turns exceeded')
      }

      if (message.subtype === 'error_max_budget_usd') {
        throw new AgentExecutionError(
          agentName,
          'AGENT_BUDGET_EXCEEDED',
          `Agent '${agentName}' exceeded budget: $${message.total_cost_usd}`,
        )
      }

      throw new AgentExecutionError(
        agentName,
        'AGENT_EXECUTION_FAILED',
        `Agent '${agentName}' failed: ${message.subtype}`,
      )
    }
  }

  throw new AgentExecutionError(
    agentName,
    'AGENT_NO_RESULT',
    `Agent '${agentName}' completed without producing a result`,
  )
}
