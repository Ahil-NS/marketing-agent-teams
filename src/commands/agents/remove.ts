import {access} from 'node:fs/promises'
import {join} from 'node:path'

import {Args, Command} from '@oclif/core'

import {InstalledAgentsRegistry} from '../../lib/agents/installed-agents.js'

export default class AgentsRemove extends Command {
  static override args = {
    package: Args.string({
      description: 'npm package name of the community agent to remove (e.g., @community/linkedin-agent)',
      required: true,
    }),
  }

  static override description = 'Remove a community agent and deregister it'

  static override examples = [
    '<%= config.bin %> agents remove @community/linkedin-agent',
    '<%= config.bin %> agents remove @community/sentiment-analyzer',
  ]

  async run(): Promise<void> {
    const {args} = await this.parse(AgentsRemove)
    const packageName = args.package

    // Step 1: Verify package is in installed-agents.json
    const registry = new InstalledAgentsRegistry()
    const agent = await registry.getAgent(packageName)
    if (!agent) {
      this.error(
        `Community agent "${packageName}" is not installed\n\nReason: Package not found in installed agents registry\nResolution: Run "mat agents list" to see installed community agents`,
        {exit: 1},
      )
    }

    // Step 2: Uninstall via oclif plugin system
    try {
      await this.config.runCommand('plugins:uninstall', [packageName])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.warn(`Plugin uninstall warning: ${detail}. Continuing with deregistration.`)
    }

    // Step 3: Remove entry from installed-agents.json
    await registry.removeAgent(packageName)

    // Step 4: Remove trust overrides if present (Story 8.5)
    await this.removeTrustOverrides(packageName)

    // Step 5: Confirmation message
    this.log(`✓ Removed community agent: ${packageName}`)
    this.log(`  Agents deregistered: ${agent.agents.join(', ')}`)
  }

  /** Remove trust overrides for the package if trust-overrides.json exists (Story 8.5). */
  private async removeTrustOverrides(packageName: string): Promise<void> {
    const overridesPath = join('.mat', 'config', 'trust-overrides.json')
    try {
      await access(overridesPath)
      const {readFile, writeFile} = await import('node:fs/promises')
      const raw = await readFile(overridesPath, 'utf-8')
      const overrides = JSON.parse(raw) as Record<string, unknown>
      if (packageName in overrides) {
        delete overrides[packageName]
        await writeFile(overridesPath, JSON.stringify(overrides, null, 2), 'utf-8')
      }
    } catch {
      // trust-overrides.json doesn't exist yet — nothing to clean
    }
  }
}
