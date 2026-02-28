import {describe, it, expect} from 'vitest'

import {
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
} from '../../../src/lib/agent-executor/errors.js'
import {MATError} from '../../../src/lib/utils/errors.js'

describe('agent-executor error classes', () => {
  const errorArgs = [
    'Test message',
    'TEST_CODE',
    'Test reason',
    'Test resolution',
    'test-source',
    'transient' as const,
  ] as const

  describe('AgentExecutionError', () => {
    it('extends MATError', () => {
      const error = new AgentExecutionError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
      expect(error).toBeInstanceOf(Error)
    })

    it('has correct name property matching class name', () => {
      const error = new AgentExecutionError(...errorArgs)
      expect(error.name).toBe('AgentExecutionError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentExecutionError(...errorArgs)
      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.reason).toBe('Test reason')
      expect(error.resolution).toBe('Test resolution')
      expect(error.source).toBe('test-source')
      expect(error.severity).toBe('transient')
    })
  })

  describe('AgentTimeoutError', () => {
    it('extends MATError', () => {
      const error = new AgentTimeoutError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
    })

    it('has correct name property', () => {
      const error = new AgentTimeoutError(...errorArgs)
      expect(error.name).toBe('AgentTimeoutError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentTimeoutError(...errorArgs)
      expect(error.message).toBe('Test message')
      expect(error.code).toBe('TEST_CODE')
      expect(error.reason).toBe('Test reason')
      expect(error.resolution).toBe('Test resolution')
      expect(error.source).toBe('test-source')
      expect(error.severity).toBe('transient')
    })
  })

  describe('AgentValidationError', () => {
    it('extends MATError', () => {
      const error = new AgentValidationError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
    })

    it('has correct name property', () => {
      const error = new AgentValidationError(...errorArgs)
      expect(error.name).toBe('AgentValidationError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentValidationError(
        'Validation failed',
        'AGENT_VALIDATION_FAILED',
        'Output does not match schema',
        'Fix the schema',
        'test-source',
        'permanent',
      )
      expect(error.severity).toBe('permanent')
    })
  })

  describe('AgentBudgetExceededError', () => {
    it('extends MATError', () => {
      const error = new AgentBudgetExceededError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
    })

    it('has correct name property', () => {
      const error = new AgentBudgetExceededError(...errorArgs)
      expect(error.name).toBe('AgentBudgetExceededError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentBudgetExceededError(...errorArgs)
      expect(error.code).toBe('TEST_CODE')
    })
  })

  describe('AgentNoResultError', () => {
    it('extends MATError', () => {
      const error = new AgentNoResultError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
    })

    it('has correct name property', () => {
      const error = new AgentNoResultError(...errorArgs)
      expect(error.name).toBe('AgentNoResultError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentNoResultError(...errorArgs)
      expect(error.resolution).toBe('Test resolution')
    })
  })

  describe('AgentAuthError', () => {
    it('extends MATError', () => {
      const error = new AgentAuthError(...errorArgs)
      expect(error).toBeInstanceOf(MATError)
    })

    it('has correct name property', () => {
      const error = new AgentAuthError(...errorArgs)
      expect(error.name).toBe('AgentAuthError')
    })

    it('populates all 6 MATError fields', () => {
      const error = new AgentAuthError(
        'Auth failed',
        'AGENT_AUTH_FAILED',
        'Token expired',
        'Run claude login',
        'agent-executor/claude',
        'permanent',
      )
      expect(error.message).toBe('Auth failed')
      expect(error.code).toBe('AGENT_AUTH_FAILED')
      expect(error.severity).toBe('permanent')
    })
  })

  describe('error code constants', () => {
    it('exports all error code constants', () => {
      expect(AGENT_EXECUTION_FAILED).toBe('AGENT_EXECUTION_FAILED')
      expect(AGENT_TIMEOUT).toBe('AGENT_TIMEOUT')
      expect(AGENT_BUDGET_EXCEEDED).toBe('AGENT_BUDGET_EXCEEDED')
      expect(AGENT_VALIDATION_FAILED).toBe('AGENT_VALIDATION_FAILED')
      expect(AGENT_NO_RESULT).toBe('AGENT_NO_RESULT')
      expect(AGENT_AUTH_FAILED).toBe('AGENT_AUTH_FAILED')
    })
  })
})
