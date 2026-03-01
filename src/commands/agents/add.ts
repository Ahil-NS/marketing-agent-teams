import {join} from 'node:path'
import {readFile, readdir, access} from 'node:fs/promises'

import {Args, Command} from '@oclif/core'

import {InstalledAgentsRegistry} from '../../lib/agents/installed-agents.js'
import type {InstalledAgent} from '../../lib/agents/installed-agents.js'
import {parseSkillMd} from '../../lib/agents/skill-loader.js'
import {validateSkillMdSafety} from '../../lib/agents/sandbox-validator.js'
import {agentDefinitionSchema} from '../../lib/schemas/agent-schema.js'
import {MATError} from '../../lib/utils/errors.js'

export default class AgentsAdd extends Command {
  static override args = {
    package: Args.string({
      description: 'npm package name of the community agent to install (e.g., @community/linkedin-agent)',
      required: true,
    }),
  }

  static override description = 'Install a community agent from an npm package'

  static override examples = [
    '<%= config.bin %> agents add @community/linkedin-agent',
    '<%= config.bin %> agents add @community/sentiment-analyzer',
  ]

  async run(): Promise<void> {
    const {args} = await this.parse(AgentsAdd)
    const packageName = args.package

    this.log(`Installing community agent: ${packageName}...`)

    // Step 1: Install npm package via oclif plugin system
    try {
      await this.config.runCommand('plugins:install', [packageName])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.error(
        `Failed to install plugin "${packageName}": ${detail}\n\nReason: npm package installation failed\nResolution: Verify the package name exists on npm and you have network connectivity`,
        {exit: 1},
      )
    }

    // Step 2: Locate SKILL.md files in installed plugin
    const plugin = this.config.plugins.get(packageName)
    if (!plugin) {
      await this.uninstallPlugin(packageName)
      this.error(
        `Plugin "${packageName}" installed but not found in oclif plugin list\n\nReason: Plugin discovery failed after installation\nResolution: Verify the package has a valid oclif configuration in package.json`,
        {exit: 1},
      )
    }

    const skillPaths = await this.discoverSkillFiles(plugin.root)
    if (skillPaths.length === 0) {
      await this.uninstallPlugin(packageName)
      this.error(
        `No SKILL.md files found in plugin "${packageName}"\n\nReason: Community agents must include at least one SKILL.md file\nResolution: Verify the plugin contains agent definitions under src/agents/ or at the package root`,
        {exit: 1},
      )
    }

    // Steps 3-6: Validate each SKILL.md
    const agentNames: string[] = []
    const validationErrors: string[] = []

    for (const skillPath of skillPaths) {
      let content: string
      try {
        content = await readFile(skillPath, 'utf-8')
      } catch {
        validationErrors.push(`Cannot read SKILL.md at ${skillPath}`)
        continue
      }

      // Step 3: Sandbox safety check
      const sandboxResult = validateSkillMdSafety(content)
      if (!sandboxResult.safe) {
        const findings = sandboxResult.findings
          .filter((f) => f.severity === 'error')
          .map((f) => `  Line ${f.line}: ${f.message}`)
          .join('\n')
        validationErrors.push(`Sandbox violation in ${skillPath}:\n${findings}`)
        continue
      }

      // Step 4: Schema validation
      try {
        const {frontMatter} = parseSkillMd(content, skillPath)
        const result = agentDefinitionSchema.safeParse(frontMatter)
        if (!result.success) {
          const issues = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n')
          validationErrors.push(`Schema validation failed for ${skillPath}:\n${issues}`)
          continue
        }

        agentNames.push(result.data.name)
      } catch (error) {
        if (error instanceof MATError) {
          validationErrors.push(`${error.message}\n  Reason: ${error.reason}\n  Resolution: ${error.resolution}`)
        } else {
          validationErrors.push(`Parse error in ${skillPath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    // Step 5: If validation fails → uninstall and report errors
    if (validationErrors.length > 0) {
      await this.uninstallPlugin(packageName)
      this.error(
        `Community agent "${packageName}" failed validation and was not installed:\n\n${validationErrors.join('\n\n')}\n\nReason: SKILL.md validation failed — agent contains unsafe patterns or invalid schema\nResolution: Contact the package author to fix the SKILL.md validation errors above`,
        {exit: 1},
      )
    }

    if (agentNames.length === 0) {
      await this.uninstallPlugin(packageName)
      this.error(
        `No valid agents found in plugin "${packageName}"\n\nReason: All SKILL.md files failed validation\nResolution: Contact the package author to fix the agent definitions`,
        {exit: 1},
      )
    }

    // Step 6: Register agent in .mat/config/installed-agents.json
    const registry = new InstalledAgentsRegistry()
    const entry: InstalledAgent = {
      package: packageName,
      version: plugin.version ?? '0.0.0',
      installedAt: new Date().toISOString(),
      trustTier: 'community',
      agents: agentNames,
      enabled: true,
    }

    await registry.addAgent(packageName, entry)

    // Step 7: Success message
    this.log(`\n✓ Installed community agent: ${packageName}`)
    this.log(`  Agents: ${agentNames.join(', ')}`)
    this.log(`  Trust tier: community`)
    this.log(`  Enabled: true`)
    this.log(`\nNote: Community agents always run at "community" trust tier. Use "mat agents trust" to promote.`)
  }

  /**
   * Discover SKILL.md files in a plugin's directory tree.
   * Searches src/agents/<cluster>/<agent>/ and the root.
   */
  private async discoverSkillFiles(pluginRoot: string): Promise<string[]> {
    const skillPaths: string[] = []

    // Check src/agents/ structure first
    const agentsRoot = join(pluginRoot, 'src', 'agents')
    try {
      await access(agentsRoot)
      const clusters = await readdir(agentsRoot, {withFileTypes: true})
      for (const cluster of clusters.filter((c) => c.isDirectory())) {
        const clusterPath = join(agentsRoot, cluster.name)
        const agents = await readdir(clusterPath, {withFileTypes: true})
        for (const agent of agents.filter((a) => a.isDirectory())) {
          const skillPath = join(clusterPath, agent.name, 'SKILL.md')
          try {
            await access(skillPath)
            skillPaths.push(skillPath)
          } catch {
            // No SKILL.md in this agent dir
          }
        }
      }
    } catch {
      // No src/agents/ directory
    }

    // Also check root for a SKILL.md
    if (skillPaths.length === 0) {
      const rootSkill = join(pluginRoot, 'SKILL.md')
      try {
        await access(rootSkill)
        skillPaths.push(rootSkill)
      } catch {
        // No root SKILL.md
      }
    }

    return skillPaths
  }

  /** Uninstall plugin (best-effort cleanup on validation failure). */
  private async uninstallPlugin(packageName: string): Promise<void> {
    try {
      await this.config.runCommand('plugins:uninstall', [packageName])
    } catch {
      this.warn(`Failed to uninstall plugin "${packageName}" during rollback. Manual cleanup may be needed.`)
    }
  }
}
