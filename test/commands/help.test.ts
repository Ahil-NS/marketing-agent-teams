import {describe, expect, it} from 'vitest'
import {runCommand} from '@oclif/test'

describe('mat --help', () => {
  it('displays all expected commands', async () => {
    const {stdout} = await runCommand(['--help'], {root: import.meta.url})

    expect(stdout).toContain('install')
    expect(stdout).toContain('run')
    expect(stdout).toContain('review')
    expect(stdout).toContain('status')
    expect(stdout).toContain('config')
    expect(stdout).toContain('agents')
    expect(stdout).toContain('logs')
  })

  it('displays the project description', async () => {
    const {stdout} = await runCommand(['--help'], {root: import.meta.url})

    expect(stdout).toContain('marketing')
  })

  it('each implemented command runs without crashing', async () => {
    // Commands that can run without arguments or .mat/ directory
    const commands = ['review', 'agents:list']

    for (const cmd of commands) {
      const {error} = await runCommand([cmd], {root: import.meta.url})
      expect(error).toBeUndefined()
    }
  })
})
