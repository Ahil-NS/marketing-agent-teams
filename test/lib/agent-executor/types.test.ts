import {describe, it, expect} from 'vitest'

import type {
  AgentExecuteOptions,
  AgentInput,
  AgentMessage,
  BudgetConstraint,
  CostEstimate,
} from '../../../src/lib/agent-executor/types.js'

describe('agent-executor type contracts', () => {
  it('AgentInput compiles with required prompt', () => {
    const input: AgentInput = {prompt: 'test'}
    expect(input.prompt).toBe('test')
  })

  it('AgentInput compiles with optional context', () => {
    const input: AgentInput = {prompt: 'test', context: {key: 'value'}}
    expect(input.context).toEqual({key: 'value'})
  })

  it('BudgetConstraint compiles with required maxCostUsd', () => {
    const budget: BudgetConstraint = {maxCostUsd: 1.0}
    expect(budget.maxCostUsd).toBe(1.0)
  })

  it('BudgetConstraint compiles with optional maxTurns', () => {
    const budget: BudgetConstraint = {maxCostUsd: 1.0, maxTurns: 10}
    expect(budget.maxTurns).toBe(10)
  })

  it('AgentExecuteOptions compiles with required fields', () => {
    const options: AgentExecuteOptions = {
      agentName: 'test-agent',
      skillMd: '# Agent Prompt',
      input: {prompt: 'Analyze this'},
    }
    expect(options.agentName).toBe('test-agent')
  })

  it('AgentExecuteOptions compiles with all optional fields', () => {
    const options: AgentExecuteOptions = {
      agentName: 'test-agent',
      skillMd: '# Agent Prompt',
      input: {prompt: 'Analyze this', context: {brand: 'TestCo'}},
      model: 'haiku',
      allowedTools: ['WebSearch', 'WebFetch'],
      budget: {maxCostUsd: 0.5, maxTurns: 10},
    }
    expect(options.model).toBe('haiku')
    expect(options.allowedTools).toEqual(['WebSearch', 'WebFetch'])
  })

  it('AgentMessage compiles as progress', () => {
    const msg: AgentMessage = {type: 'progress'}
    expect(msg.type).toBe('progress')
  })

  it('AgentMessage compiles as success result', () => {
    const msg: AgentMessage = {
      type: 'result',
      subtype: 'success',
      result: 'output text',
      totalCostUsd: 0.002,
      usage: {inputTokens: 100, outputTokens: 50},
      numTurns: 3,
      durationMs: 4500,
    }
    expect(msg.subtype).toBe('success')
  })

  it('AgentMessage compiles as error result', () => {
    const msg: AgentMessage = {
      type: 'result',
      subtype: 'error_max_turns',
      errors: [{message: 'exceeded limit'}],
    }
    expect(msg.subtype).toBe('error_max_turns')
  })

  it('CostEstimate compiles with all fields', () => {
    const estimate: CostEstimate = {
      estimatedCostUsd: 0.003,
      model: 'haiku',
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 1.25,
    }
    expect(estimate.estimatedCostUsd).toBe(0.003)
  })
})
