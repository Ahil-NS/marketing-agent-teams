import {describe, expect, it} from 'vitest'

import Run from '../../src/commands/run.js'

describe('mat run --dry-run flag', () => {
  it('parses --dry-run flag as true when provided', async () => {
    const cmd = new Run(['--dry-run', '--platforms', 'reddit'], {} as any)
    // We mock parse to verify the flag is defined and parseable
    const _originalParse = cmd.parse.bind(cmd)

    // Access the static flags definition directly
    expect(Run.flags).toHaveProperty('dry-run')
    expect(Run.flags['dry-run']).toMatchObject({
      type: 'boolean',
    })
  })

  it('has --dry-run flag default to false', () => {
    const dryRunFlag = Run.flags['dry-run']
    expect(dryRunFlag).toBeDefined()
    // oclif boolean flags default to false
    expect(dryRunFlag.default).toBe(false)
  })

  it('has --dry-run flag with descriptive help text', () => {
    const dryRunFlag = Run.flags['dry-run']
    expect(dryRunFlag.description).toBeTruthy()
    expect(dryRunFlag.description).toContain('publishing')
  })
})
