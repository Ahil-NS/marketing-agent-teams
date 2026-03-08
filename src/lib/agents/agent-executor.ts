import type {z} from 'zod'

import type {AgentExecutor} from '../agent-executor/index.js'
import {createAgentExecutor} from '../agent-executor/index.js'
import {AgentNoResultError} from '../agent-executor/errors.js'

import type {AgentResult} from './types.js'
import {AgentValidationError} from './errors.js'

export interface AgentExecuteOptions<T> {
  prompt: string
  systemPrompt: string
  allowedTools: string[]
  model: 'haiku' | 'sonnet'
  outputSchema: z.ZodType<T>
  maxTurns?: number
  maxBudgetUsd?: number
}

/**
 * Backward-compatible wrapper around AgentExecutor.execute().
 * Accepts an optional executor parameter to allow injecting the
 * ClaudeCliExecutor for native mode execution.
 */
export async function executeAgent<T>(
  agentName: string,
  options: AgentExecuteOptions<T>,
  injectedExecutor?: AgentExecutor,
): Promise<AgentResult<T>> {
  const executor = injectedExecutor ?? createAgentExecutor()
  const startTime = Date.now()

  for await (const message of executor.execute({
    agentName,
    skillMd: options.systemPrompt,
    input: {prompt: options.prompt},
    model: options.model,
    allowedTools: options.allowedTools,
    budget: {
      maxCostUsd: options.maxBudgetUsd ?? Infinity,
      maxTurns: options.maxTurns ?? 15,
    },
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      // Validate output with Zod
      let jsonData: unknown
      try {
        jsonData = JSON.parse(stripCodeFences(message.result ?? ''))
      } catch {
        throw new AgentValidationError(
          agentName,
          new Error(`Agent returned invalid JSON: ${(message.result ?? '').slice(0, 200)}`),
        )
      }

      const parsed = options.outputSchema.safeParse(jsonData)
      if (!parsed.success) {
        throw new AgentValidationError(agentName, parsed.error)
      }

      return {
        agentName,
        runId: '',
        status: 'success',
        outputs: parsed.data,
        usage: {
          inputTokens: message.usage?.inputTokens ?? 0,
          outputTokens: message.usage?.outputTokens ?? 0,
          cost: message.totalCostUsd ?? 0,
          // FR28: AI model attribution fields
          modelName: message.model ?? options.model,
          provider: 'anthropic',
          timestamp: new Date().toISOString(),
        },
        duration: Date.now() - startTime,
        errors: [],
      }
    }
  }

  // Should not reach here — ClaudeAgentExecutor throws on all error paths
  throw new AgentNoResultError(
    `Agent '${agentName}' completed without result`,
    'AGENT_NO_RESULT',
    `Agent '${agentName}' completed without result — this should not happen`,
    'Check the ClaudeAgentExecutor implementation for missing error handlers',
    `agents/${agentName}`,
    'transient',
  )
}

/**
 * Strip markdown code fences from agent output.
 * LLMs often wrap JSON in ```json ... ``` despite instructions not to.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const match = /^```\w*\s*\n([\s\S]*?)\n\s*```\s*$/.exec(trimmed)
  return match ? match[1].trim() : trimmed
}
