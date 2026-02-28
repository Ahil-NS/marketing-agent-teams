import {Command, Flags} from '@oclif/core'

import {listAgentsByCluster, readConfig, setAgentToggle, writeConfig} from '../../lib/config/index.js'

export default class ConfigAgents extends Command {
  static override description = 'List, enable, or disable individual agents'
  static override enableJsonFlag = true

  static override flags = {
    disable: Flags.string({description: 'Disable an agent by name'}),
    enable: Flags.string({description: 'Enable an agent by name'}),
  }

  async run(): Promise<Record<string, unknown>> {
    const {flags} = await this.parse(ConfigAgents)
    const {raw, validated} = await readConfig(process.cwd())

    if (flags.enable) {
      setAgentToggle(raw, flags.enable, true)
      await writeConfig(process.cwd(), raw)
      this.log(`Agent "${flags.enable}" enabled.`)
      return {agent: flags.enable, enabled: true}
    }

    if (flags.disable) {
      setAgentToggle(raw, flags.disable, false)
      await writeConfig(process.cwd(), raw)
      this.log(`Agent "${flags.disable}" disabled.`)
      return {agent: flags.disable, enabled: false}
    }

    const result = listAgentsByCluster(validated)
    for (const [cluster, agents] of Object.entries(result)) {
      this.log(`\n  ${cluster.charAt(0).toUpperCase() + cluster.slice(1)}:`)
      for (const agent of agents) {
        const status = agent.enabled ? '✓' : '✗'
        this.log(`    ${status} ${agent.name}`)
      }
    }
    this.log('')

    return result
  }
}
