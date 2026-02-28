import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

export class AgentExecutionError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AgentTimeoutError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AgentValidationError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AgentBudgetExceededError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AgentNoResultError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

export class AgentAuthError extends MATError {
  constructor(
    message: string,
    code: string,
    reason: string,
    resolution: string,
    source: string,
    severity: ErrorSeverity,
  ) {
    super(message, code, reason, resolution, source, severity)
  }
}

// Error code constants
export const AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED'
export const AGENT_TIMEOUT = 'AGENT_TIMEOUT'
export const AGENT_BUDGET_EXCEEDED = 'AGENT_BUDGET_EXCEEDED'
export const AGENT_VALIDATION_FAILED = 'AGENT_VALIDATION_FAILED'
export const AGENT_NO_RESULT = 'AGENT_NO_RESULT'
export const AGENT_AUTH_FAILED = 'AGENT_AUTH_FAILED'
