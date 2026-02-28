import {describe, expect, it} from 'vitest'

import {CLI_COMMAND_NOT_FOUND, MATError} from '../../../src/lib/utils/errors.js'

describe('MATError', () => {
  it('constructs with all required properties', () => {
    const error = new MATError(
      'Command not found',
      CLI_COMMAND_NOT_FOUND,
      'The command "mat foo" does not exist',
      'Run "mat --help" for available commands',
      'cli',
      'permanent',
    )

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(MATError)
    expect(error.message).toBe('Command not found')
    expect(error.code).toBe('CLI_COMMAND_NOT_FOUND')
    expect(error.reason).toBe('The command "mat foo" does not exist')
    expect(error.resolution).toBe('Run "mat --help" for available commands')
    expect(error.source).toBe('cli')
    expect(error.severity).toBe('permanent')
    expect(error.name).toBe('MATError')
  })

  it('supports transient severity', () => {
    const error = new MATError(
      'Timeout',
      'API_TIMEOUT',
      'API request timed out',
      'Retry the request',
      'api',
      'transient',
    )

    expect(error.severity).toBe('transient')
  })

  it('is throwable and catchable', () => {
    const error = new MATError(
      'Test error',
      'TEST_CODE',
      'Testing',
      'Fix it',
      'test',
      'permanent',
    )

    expect(() => {
      throw error
    }).toThrow(MATError)
  })

  it('has correct stack trace', () => {
    const error = new MATError(
      'Stack test',
      'STACK_TEST',
      'reason',
      'resolution',
      'source',
      'permanent',
    )

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('Stack test')
  })
})

describe('error code constants', () => {
  it('CLI_COMMAND_NOT_FOUND uses SCREAMING_SNAKE_CASE with component prefix', () => {
    expect(CLI_COMMAND_NOT_FOUND).toBe('CLI_COMMAND_NOT_FOUND')
  })
})
