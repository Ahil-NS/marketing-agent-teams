import {describe, it, expect} from 'vitest'

import {
  createAgentExecutor,
  ClaudeAgentExecutor,
} from '../../../src/lib/agent-executor/index.js'
import type {AgentExecutor} from '../../../src/lib/agent-executor/index.js'

describe('createAgentExecutor factory', () => {
  it('returns an instance implementing AgentExecutor', () => {
    const executor = createAgentExecutor()
    expect(executor).toBeDefined()
    expect(typeof executor.execute).toBe('function')
    expect(typeof executor.estimateCost).toBe('function')
  })

  it('returns ClaudeAgentExecutor', () => {
    const executor = createAgentExecutor()
    expect(executor).toBeInstanceOf(ClaudeAgentExecutor)
  })

  it('returns ClaudeAgentExecutor when provider is "claude"', () => {
    const executor = createAgentExecutor('claude')
    expect(executor).toBeInstanceOf(ClaudeAgentExecutor)
  })

  it('returns ClaudeAgentExecutor for unknown provider (MVP)', () => {
    const executor = createAgentExecutor('unknown-provider')
    expect(executor).toBeInstanceOf(ClaudeAgentExecutor)
  })

  it('returns a new instance each call', () => {
    const a = createAgentExecutor()
    const b = createAgentExecutor()
    expect(a).not.toBe(b)
  })

  it('satisfies AgentExecutor interface at type level', () => {
    // This test verifies at compile time that createAgentExecutor returns AgentExecutor
    const executor: AgentExecutor = createAgentExecutor()
    expect(executor).toBeDefined()
  })
})
