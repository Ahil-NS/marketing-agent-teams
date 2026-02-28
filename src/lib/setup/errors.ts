import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

export class SetupError extends MATError {
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

export class ClaudeAuthError extends MATError {
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

export const SETUP_CLAUDE_NOT_FOUND = 'SETUP_CLAUDE_NOT_FOUND'
export const SETUP_CLAUDE_AUTH_FAILED = 'SETUP_CLAUDE_AUTH_FAILED'
export const SETUP_SCAFFOLD_FAILED = 'SETUP_SCAFFOLD_FAILED'
export const SETUP_CONFIG_WRITE_FAILED = 'SETUP_CONFIG_WRITE_FAILED'
