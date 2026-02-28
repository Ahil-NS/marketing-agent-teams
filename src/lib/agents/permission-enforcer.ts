import type {TrustTier} from '../credentials/types.js'
import type {SkillDefinition, PermissionEnforcementResult} from './types.js'
import {TrustViolationError} from '../credentials/errors.js'
import {PermissionDeniedError} from './errors.js'
import {VALID_SDK_TOOLS} from '../schemas/agent-schema.js'

/**
 * Trust tier tool restrictions.
 * - builtin: all SDK tools (full access for core agents)
 * - verified: all except Bash (reviewed community agents — no shell execution)
 * - community: read-only tools only (unreviewed agents — no write/execute)
 */
const TRUST_TIER_ALLOWED_TOOLS: Record<TrustTier, readonly string[]> = {
  builtin: VALID_SDK_TOOLS,
  verified: VALID_SDK_TOOLS.filter((t) => t !== 'Bash'),
  community: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
} as const

/**
 * Trust tier credential restrictions.
 * - builtin: full credential access
 * - verified: standard credential access (declared credentials only)
 * - community: no credential access at all
 */
const TRUST_TIER_ALLOWS_CREDENTIALS: Record<TrustTier, boolean> = {
  builtin: true,
  verified: true,
  community: false,
} as const

/**
 * Enforces agent permission boundaries at execution time.
 *
 * Integration contract:
 * - Stage-runner calls validatePermissions() BEFORE AgentExecutor.execute()
 * - Stage-runner passes resolveEffectiveTools() output as allowedTools
 * - Stage-runner calls enforceCredentialScope() before each credential injection
 * - CredentialManager (Story 1.6) handles the actual credential resolution —
 *   PermissionEnforcer provides the authorization check layer on top
 */
export class PermissionEnforcer {
  /**
   * Validates that an agent's declared permissions are compatible with its trust tier.
   * Called once per agent execution, before AgentExecutor.execute().
   *
   * @param skillDefinition - Parsed SKILL.md with permissions block
   * @param trustTier - Agent's trust tier from SKILL.md front matter or trust overrides
   * @returns PermissionEnforcementResult with allowed status, violations, and effective tools
   */
  validatePermissions(
    skillDefinition: SkillDefinition,
    trustTier: TrustTier,
  ): PermissionEnforcementResult {
    const violations: string[] = []
    const permissions = skillDefinition.permissions ?? {
      credentials: [],
      dataScopes: [],
      toolScopes: [],
    }

    // Check credential access against trust tier
    if (
      permissions.credentials.length > 0 &&
      !TRUST_TIER_ALLOWS_CREDENTIALS[trustTier]
    ) {
      violations.push(
        `Trust tier '${trustTier}' does not allow credential access. ` +
          `Agent declares credentials: [${permissions.credentials.join(', ')}]. ` +
          `Promote to 'verified' tier to enable credential access.`,
      )
    }

    // Check tool declarations against trust tier
    const tierAllowed = TRUST_TIER_ALLOWED_TOOLS[trustTier]
    const declaredTools = skillDefinition.tools ?? []
    const blockedTools = declaredTools.filter(
      (tool) => !tierAllowed.includes(tool),
    )
    if (blockedTools.length > 0) {
      violations.push(
        `Trust tier '${trustTier}' does not allow tools: [${blockedTools.join(', ')}]. ` +
          `Allowed tools for '${trustTier}': [${tierAllowed.join(', ')}].`,
      )
    }

    // Check toolScopes is a subset of declared tools
    const undeclaredToolScopes = permissions.toolScopes.filter(
      (scope) => !declaredTools.includes(scope),
    )
    if (undeclaredToolScopes.length > 0) {
      violations.push(
        `toolScopes references tools not declared in 'tools': [${undeclaredToolScopes.join(', ')}]. ` +
          `Add them to the 'tools' array in SKILL.md front matter.`,
      )
    }

    const effectiveTools = this.resolveEffectiveTools(
      skillDefinition,
      trustTier,
    )

    return {
      allowed: violations.length === 0,
      violations,
      effectiveTools,
      trustTier,
      agentName: skillDefinition.name,
    }
  }

  /**
   * Computes the final allowedTools array for AgentExecutor.execute().
   * Result = intersection of (declared tools) AND (trust-tier-allowed tools).
   * Never a union — always the most restrictive set.
   */
  resolveEffectiveTools(
    skillDefinition: SkillDefinition,
    trustTier: TrustTier,
  ): string[] {
    const declaredTools = skillDefinition.tools ?? []
    const tierAllowed = TRUST_TIER_ALLOWED_TOOLS[trustTier]
    return declaredTools.filter((tool) => tierAllowed.includes(tool))
  }

  /**
   * Enforces that a requested tool is within the agent's declared scope.
   * Called when the agent runtime needs to verify dynamic tool access.
   *
   * Note: Story spec defined this as (declaredTools[], requestedTools[], trustTier): string[].
   * Implemented as single-tool guard instead — resolveEffectiveTools() handles bulk filtering,
   * this method handles per-access enforcement. Better separation of concerns.
   *
   * @throws PermissionDeniedError if tool is not in declared tools
   */
  enforceToolScope(
    declaredTools: string[],
    requestedTool: string,
    agentName: string,
  ): void {
    if (!declaredTools.includes(requestedTool)) {
      throw new PermissionDeniedError(
        agentName,
        'tool',
        requestedTool,
        declaredTools,
      )
    }
  }

  /**
   * Enforces that a requested credential is within the agent's declared scope.
   * Called before each credential injection from CredentialManager.resolveForAgent().
   *
   * @throws TrustViolationError if credential is not in declared credentials
   */
  enforceCredentialScope(
    declaredCredentials: string[],
    requestedCredential: string,
    agentName: string,
  ): void {
    if (!declaredCredentials.includes(requestedCredential)) {
      throw new TrustViolationError(
        agentName,
        requestedCredential,
        declaredCredentials,
      )
    }
  }

  /**
   * Enforces that a requested data scope is within the agent's declared scope.
   * Called before the agent accesses pipeline state, config, or other data stores.
   *
   * @throws PermissionDeniedError if data scope is not declared
   */
  enforceDataScope(
    declaredScopes: string[],
    requestedScope: string,
    agentName: string,
  ): void {
    if (!declaredScopes.includes(requestedScope)) {
      throw new PermissionDeniedError(
        agentName,
        'dataScope',
        requestedScope,
        declaredScopes,
      )
    }
  }
}
