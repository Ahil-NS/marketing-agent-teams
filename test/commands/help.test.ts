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

  it('each command stub logs not-yet-implemented', async () => {
    const commands = ['run', 'review', 'status', 'config', 'agents:list', 'logs']

    for (const cmd of commands) {
      const {stdout} = await runCommand([cmd], {root: import.meta.url})
      expect(stdout).toContain('Not yet implemented')
    }
  })
})
