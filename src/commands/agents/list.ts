import {join} from 'node:path'

import {Command, Flags} from '@oclif/core'

import {loadAllSkills} from '../../lib/agents/skill-loader.js'
import {InstalledAgentsRegistry} from '../../lib/agents/installed-agents.js'
import {TrustOverrideStore} from '../../lib/credentials/trust-overrides.js'
import {getEffectiveTrustTier} from '../../lib/credentials/trust-tiers.js'
import type {TrustOverrides} from '../../lib/credentials/trust-tiers.js'

export interface AgentListEntry {
  name: string
  cluster: string
  trustTier: string
  source: 'builtin' | 'community'
  enabled: boolean
}

export default class AgentsList extends Command {
  static override description = 'List available agents and their status'

  static enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> agents list',
    '<%= config.bin %> agents list --json',
  ]

  static override flags = {
    format: Flags.string({
      description: 'Output format',
      options: ['table', 'json'],
      default: 'table',
    }),
  }

  async run(): Promise<Record<string, unknown> | void> {
    const {flags} = await this.parse(AgentsList)

    const entries: AgentListEntry[] = []

    // Load trust overrides for effective tier resolution
    const overrideStore = new TrustOverrideStore()
    let overridesMap: TrustOverrides = {}
    try {
      overridesMap = await overrideStore.getOverridesMap()
    } catch {
      // Override file may not exist — continue with defaults
    }

    // Load built-in agents from src/agents/
    const agentsRoot = join(process.cwd(), 'src', 'agents')
    try {
      const skills = await loadAllSkills(agentsRoot)
      for (const [, skill] of skills) {
        entries.push({
          name: skill.name,
          cluster: skill.cluster,
          trustTier: skill.trustTier,
          source: 'builtin',
          enabled: true,
        })
      }
    } catch {
      // src/agents/ may not exist or have issues — continue with community agents
    }

    // Load community agents from .mat/config/installed-agents.json
    const registry = new InstalledAgentsRegistry()
    try {
      const installed = await registry.listAll()
      for (const [, agent] of Object.entries(installed)) {
        for (const agentName of agent.agents) {
          const effectiveTier = getEffectiveTrustTier(agentName, 'community', overridesMap)
          const isOverridden = agentName in overridesMap
          entries.push({
            name: agentName,
            cluster: '-',
            trustTier: isOverridden ? `${effectiveTier}*` : effectiveTier,
            source: 'community',
            enabled: agent.enabled,
          })
        }
      }
    } catch {
      // Registry may not exist yet — continue without community agents
    }

    // Sort by cluster then name
    entries.sort((a, b) => {
      const clusterCmp = a.cluster.localeCompare(b.cluster)
      if (clusterCmp !== 0) return clusterCmp
      return a.name.localeCompare(b.name)
    })

    // JSON output
    if (flags.json || flags.format === 'json') {
      return {agents: entries, total: entries.length} as unknown as Record<string, unknown>
    }

    // Table output
    if (entries.length === 0) {
      this.log('No agents found.')
      return
    }

    // Column widths
    const nameWidth = Math.max(4, ...entries.map((e) => e.name.length))
    const clusterWidth = Math.max(7, ...entries.map((e) => e.cluster.length))
    const tierWidth = Math.max(10, ...entries.map((e) => e.trustTier.length))
    const sourceWidth = Math.max(6, ...entries.map((e) => e.source.length))

    const header = `${'Name'.padEnd(nameWidth)}  ${'Cluster'.padEnd(clusterWidth)}  ${'Trust Tier'.padEnd(tierWidth)}  ${'Source'.padEnd(sourceWidth)}  Enabled`
    const separator = '-'.repeat(header.length)

    this.log(header)
    this.log(separator)

    for (const entry of entries) {
      const enabledStr = entry.enabled ? 'yes' : 'no'
      this.log(
        `${entry.name.padEnd(nameWidth)}  ${entry.cluster.padEnd(clusterWidth)}  ${entry.trustTier.padEnd(tierWidth)}  ${entry.source.padEnd(sourceWidth)}  ${enabledStr}`,
      )
    }

    this.log(`\n${entries.length} agent(s) total`)
  }
}
