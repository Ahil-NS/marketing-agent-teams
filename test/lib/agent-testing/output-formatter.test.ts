import {describe, expect, it} from 'vitest'

import {formatTestResult, formatDuration} from '../../../src/lib/agent-testing/output-formatter.js'
import type {AgentTestResult} from '../../../src/lib/agent-testing/types.js'
import {MATError} from '../../../src/lib/utils/errors.js'

function createTestResult(overrides?: Partial<AgentTestResult>): AgentTestResult {
  return {
    agentName: 'trend-scout',
    cluster: 'intelligence',
    status: 'success',
    content: 'Test generated content here',
    outputs: {mockData: 'output'},
    usage: {
      inputTokens: 1234,
      outputTokens: 567,
      totalTokens: 1801,
      cost: 0.0042,
    },
    duration: 4200,
    model: 'haiku',
    turns: 3,
    errors: [],
    ...overrides,
  }
}

describe('formatTestResult', () => {
  describe('human-readable format', () => {
    it('should include section headers', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).toContain('--- Agent Test: trend-scout (intelligence) ---')
      expect(output).toContain('--- Generated Content ---')
      expect(output).toContain('--- Usage ---')
      expect(output).toContain('--- Status: success ---')
    })

    it('should include model, turns, and duration', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).toContain('Model: haiku')
      expect(output).toContain('Turns: 3')
      expect(output).toContain('Duration: 4.2s')
    })

    it('should include generated content', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).toContain('Test generated content here')
    })

    it('should format token usage', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).toContain('Input tokens:')
      expect(output).toContain('Output tokens:')
      expect(output).toContain('Total tokens:')
    })

    it('should format cost with 4 decimal places', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).toContain('$0.0042')
    })

    it('should display error details when errors exist', () => {
      const error = new MATError(
        'Test error message',
        'TEST_ERROR',
        'Something went wrong',
        'Fix it by doing X',
        'test',
        'transient',
      )
      const result = createTestResult({errors: [error]})

      const output = formatTestResult(result, false)

      expect(output).toContain('--- Errors ---')
      expect(output).toContain('[TEST_ERROR]')
      expect(output).toContain('Reason: Something went wrong')
      expect(output).toContain('Resolution: Fix it by doing X')
    })

    it('should not display errors section when no errors', () => {
      const output = formatTestResult(createTestResult(), false)

      expect(output).not.toContain('--- Errors ---')
    })

    it('should display partial status', () => {
      const result = createTestResult({status: 'partial'})
      const output = formatTestResult(result, false)

      expect(output).toContain('--- Status: partial ---')
    })
  })

  describe('JSON format', () => {
    it('should return valid JSON with all AgentTestResult fields', () => {
      const result = createTestResult()
      const output = formatTestResult(result, true)

      const parsed = JSON.parse(output)
      expect(parsed.agentName).toBe('trend-scout')
      expect(parsed.cluster).toBe('intelligence')
      expect(parsed.status).toBe('success')
      expect(parsed.usage.inputTokens).toBe(1234)
      expect(parsed.usage.outputTokens).toBe(567)
      expect(parsed.usage.totalTokens).toBe(1801)
      expect(parsed.usage.cost).toBe(0.0042)
      expect(parsed.model).toBe('haiku')
      expect(parsed.turns).toBe(3)
      expect(parsed.duration).toBe(4200)
    })

    it('should produce pretty-printed JSON', () => {
      const result = createTestResult()
      const output = formatTestResult(result, true)

      expect(output).toContain('\n')
      expect(output).toContain('  ')
    })
  })
})

describe('formatDuration', () => {
  it('should format milliseconds under 1000 as ms', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(0)).toBe('0ms')
    expect(formatDuration(999)).toBe('999ms')
  })

  it('should format milliseconds 1000+ as seconds with 1 decimal', () => {
    expect(formatDuration(1000)).toBe('1.0s')
    expect(formatDuration(4200)).toBe('4.2s')
    expect(formatDuration(15700)).toBe('15.7s')
  })
})
