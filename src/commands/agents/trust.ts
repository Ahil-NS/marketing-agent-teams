import {Args, Command, Flags} from '@oclif/core'

import {TrustOverrideStore} from '../../lib/credentials/trust-overrides.js'
import {TRUST_TIER_CONFIGS} from '../../lib/credentials/trust-tiers.js'
import {InstalledAgentsRegistry} from '../../lib/agents/installed-agents.js'

export default class AgentsTrust extends Command {
  static override args = {
    agent: Args.string({
      description: 'Agent name to modify trust tier (e.g., @community/linkedin-agent)',
      required: true,
    }),
    tier: Args.string({
      description: 'Target trust tier (verified)',
      required: false,
    }),
  }

  static override description = 'Promote or revoke trust tier for a community agent'

  static override examples = [
    '<%= config.bin %> agents trust @community/linkedin-agent verified',
    '<%= config.bin %> agents trust @community/linkedin-agent --revoke',
    '<%= config.bin %> agents trust @community/linkedin-agent --reason "Code reviewed and approved"',
  ]

  static override flags = {
    revoke: Flags.boolean({
      description: 'Revoke trust override and reset to community tier',
      default: false,
    }),
    reason: Flags.string({
      description: 'Reason for the trust tier change',
      default: 'Manually promoted via CLI',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AgentsTrust)
    const agentName = args.agent

    const overrideStore = new TrustOverrideStore()

    // Handle --revoke flag
    if (flags.revoke) {
      const removed = await overrideStore.removeOverride(agentName)
      if (!removed) {
        this.log(`No trust override found for '${agentName}' — already at default community tier.`)
        return
      }

      this.log(`Trust override revoked for '${agentName}'.`)
      this.log(`Trust tier reset to: community`)
      this.log(`Capabilities: ${TRUST_TIER_CONFIGS.community.description}`)
      this.log(`  Credentials: denied`)
      this.log(`  Publish: denied`)
      return
    }

    // Validate tier argument is present when not revoking
    const tier = args.tier
    if (!tier) {
      this.error(
        `Missing required argument: tier\n\nUsage: mat agents trust <agent-name> <tier>\nExample: mat agents trust @community/linkedin-agent verified`,
        {exit: 1},
      )
    }

    // Validate tier is 'verified' — the only valid promotion target
    if (tier !== 'verified') {
      if (tier === 'builtin') {
        this.error(
          `Only core platform agents can have builtin trust tier.\n\nCommunity agents can be promoted to 'verified' at most.\nUsage: mat agents trust ${agentName} verified`,
          {exit: 1},
        )
      }

      if (tier === 'community') {
        this.log(`Agent '${agentName}' is already at community tier by default. Use --revoke to reset an override.`)
        return
      }

      this.error(
        `Invalid trust tier: '${tier}'. Valid options: verified\n\nUsage: mat agents trust ${agentName} verified`,
        {exit: 1},
      )
    }

    // Check if agent exists in installed agents registry
    const registry = new InstalledAgentsRegistry()
    let isInstalled = false
    try {
      const installed = await registry.loadRegistry()
      for (const [, entry] of Object.entries(installed)) {
        if (entry.agents.includes(agentName)) {
          isInstalled = true
          break
        }
      }
    } catch {
      // Registry may not exist — continue (agent may still be valid)
    }

    if (!isInstalled) {
      this.warn(`Agent '${agentName}' not found in installed agents registry. Proceeding with trust override anyway.`)
    }

    // Apply the override
    try {
      const override = await overrideStore.setOverride(
        agentName,
        'verified',
        'user',
        flags.reason,
        false, // community agents are not builtin
      )

      const config = TRUST_TIER_CONFIGS.verified
      this.log(`Trust tier updated for '${agentName}'.`)
      this.log(`Trust tier: verified`)
      this.log(`Capabilities: ${config.description}`)
      this.log(`  Credentials: allowed`)
      this.log(`  Publish: allowed`)
      this.log(`  Tools: ${config.allowedTools.join(', ')}`)
      this.log(`Promoted at: ${override.promotedAt}`)
      this.log(`Reason: ${override.reason}`)
    } catch (error) {
      if (error instanceof Error) {
        this.error(error.message, {exit: 1})
      }
      throw error
    }
  }
}
