import {vi} from 'vitest'

export interface MockResultMessage {
  type: 'result'
  subtype: 'success' | 'error_max_turns' | 'error_max_budget_usd' | 'error_during_execution'
  result: string
  total_cost_usd?: number
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  model?: string
  num_turns?: number
  duration_ms?: number
  errors?: string[]
}

export function createSuccessMessage(jsonOutput: unknown, model?: string): MockResultMessage {
  return {
    type: 'result',
    subtype: 'success',
    result: JSON.stringify(jsonOutput),
    total_cost_usd: 0.0025,
    usage: {input_tokens: 450, output_tokens: 380},
    model,
    num_turns: 3,
    duration_ms: 4500,
  }
}

export function createErrorMessage(
  subtype: 'error_max_turns' | 'error_max_budget_usd' | 'error_during_execution',
  costUsd = 0.001,
): MockResultMessage {
  return {
    type: 'result',
    subtype,
    result: '',
    total_cost_usd: costUsd,
    usage: {input_tokens: 100, output_tokens: 0},
    errors: [`Agent failed with ${subtype}`],
  }
}

async function* generateMessages(messages: MockResultMessage[]): AsyncGenerator<MockResultMessage> {
  for (const msg of messages) {
    yield msg
  }
}

export function createMockQuery(messages: MockResultMessage[]) {
  return vi.fn(() => generateMessages(messages))
}

export function createMockQueryThatThrows(error: Error) {
  return vi.fn(() => {
    throw error
  })
}
