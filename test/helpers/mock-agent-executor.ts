import {vi} from 'vitest'

import type {AgentResult} from '../../src/lib/agents/types.js'

export function createMockAgentResult(
  agentName: string,
  overrides?: Partial<AgentResult>,
): AgentResult {
  return {
    agentName,
    status: 'success',
    outputs: {mockData: `output from ${agentName}`},
    usage: {inputTokens: 100, outputTokens: 50, cost: 0.001},
    duration: 1500,
    errors: [],
    ...overrides,
  }
}

export function createMockExecuteAgent(
  resultMap: Record<string, AgentResult | Error>,
) {
  return vi.fn(async (agentName: string) => {
    const result = resultMap[agentName]
    if (result instanceof Error) throw result
    if (!result) throw new Error(`No mock result for agent: ${agentName}`)
    return result
  })
}
