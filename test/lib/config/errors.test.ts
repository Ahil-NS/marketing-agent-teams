import {describe, expect, it} from 'vitest'

import {ConfigReadError, ConfigValidationError, ConfigWriteError} from '../../../src/lib/config/errors.js'
import {MATError} from '../../../src/lib/utils/errors.js'

describe('config errors', () => {
  it('ConfigReadError extends MATError with correct code', () => {
    const error = new ConfigReadError('file not found', 'run mat install')
    expect(error).toBeInstanceOf(MATError)
    expect(error.code).toBe('CONFIG_READ_FAILED')
    expect(error.reason).toBe('file not found')
    expect(error.resolution).toBe('run mat install')
    expect(error.source).toBe('lib/config')
    expect(error.severity).toBe('permanent')
  })

  it('ConfigWriteError extends MATError with correct code', () => {
    const error = new ConfigWriteError('disk full', 'free space')
    expect(error).toBeInstanceOf(MATError)
    expect(error.code).toBe('CONFIG_WRITE_FAILED')
    expect(error.severity).toBe('permanent')
  })

  it('ConfigWriteError accepts custom severity', () => {
    const error = new ConfigWriteError('temporary IO', 'retry', 'transient')
    expect(error.severity).toBe('transient')
  })

  it('ConfigValidationError extends MATError with correct code', () => {
    const error = new ConfigValidationError('invalid field', 'fix config')
    expect(error).toBeInstanceOf(MATError)
    expect(error.code).toBe('CONFIG_VALIDATION_FAILED')
    expect(error.source).toBe('lib/config')
  })
})
