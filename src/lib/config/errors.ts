import {MATError} from '../utils/errors.js'
import type {ErrorSeverity} from '../utils/errors.js'

export class ConfigReadError extends MATError {
  constructor(reason: string, resolution: string) {
    super('Failed to read config.yaml', 'CONFIG_READ_FAILED', reason, resolution, 'lib/config', 'permanent')
  }
}

export class ConfigWriteError extends MATError {
  constructor(reason: string, resolution: string, severity: ErrorSeverity = 'permanent') {
    super('Failed to write config.yaml', 'CONFIG_WRITE_FAILED', reason, resolution, 'lib/config', severity)
  }
}

export class ConfigValidationError extends MATError {
  constructor(reason: string, resolution: string) {
    super('Config validation failed', 'CONFIG_VALIDATION_FAILED', reason, resolution, 'lib/config', 'permanent')
  }
}
