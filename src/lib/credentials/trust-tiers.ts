import type {TrustTier} from './types.js'
import {VALID_SDK_TOOLS} from '../schemas/agent-schema.js'

/**
 * Configuration for a single trust tier — defines what capabilities
 * agents at that tier are allowed to use.
 */
export interface TrustTierConfig {
  /** SDK tools the agent may invoke */
  readonly allowedTools: readonly string[]
  /** Whether the agent can access OS keychain credentials */
  readonly allowsCredentials: boolean
  /** Whether the agent can call PlatformAdapter.publish() */
  readonly allowsPublish: boolean
  /** Human-readable description of the tier */
  readonly description: string
}

/**
 * Trust tier overrides record — maps agent name to override tier.
 * Used by getEffectiveTrustTier() to resolve promotions.
 */
export type TrustOverrides = Record<string, TrustTier>

/**
 * Canonical trust tier configuration — single source of truth.
 *
 * PermissionEnforcer imports TRUST_TIER_CONFIGS.allowedTools and
 * TRUST_TIER_CONFIGS.allowsCredentials instead of maintaining its own constants.
 *
 * - builtin: core platform agents shipped with npm package — full access
 * - verified: reviewed community agents — all tools except Bash
 * - community: unreviewed community agents — read-only, no credentials, no publish
 */
export const TRUST_TIER_CONFIGS: Record<TrustTier, TrustTierConfig> = {
  builtin: {
    allowedTools: VALID_SDK_TOOLS,
    allowsCredentials: true,
    allowsPublish: true,
    description: 'Core platform agents with full access',
  },
  verified: {
    allowedTools: VALID_SDK_TOOLS.filter((t) => t !== 'Bash'),
    allowsCredentials: true,
    allowsPublish: true,
    description: 'Reviewed community agents',
  },
  community: {
    allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'],
    allowsCredentials: false,
    allowsPublish: false,
    description: 'Unreviewed community agents',
  },
} as const

/**
 * Resolves the effective trust tier for an agent, considering source and overrides.
 *
 * Resolution order:
 * 1. If source === 'builtin' → always return 'builtin' (cannot be overridden)
 * 2. If override exists in trust-overrides.json → return override tier
 * 3. Else → return 'community' (default for all non-builtin agents)
 *
 * @param agentName - Agent identifier (e.g., '@community/linkedin-agent')
 * @param source - Where the agent came from: 'builtin' or 'community'
 * @param overrides - Trust tier overrides loaded from .mat/config/trust-overrides.json
 */
export function getEffectiveTrustTier(
  agentName: string,
  source: 'builtin' | 'community',
  overrides: TrustOverrides = {},
): TrustTier {
  // Builtin agents are immutable — their tier cannot be changed
  if (source === 'builtin') {
    return 'builtin'
  }

  // Check for user-applied override
  const override = overrides[agentName]
  if (override !== undefined) {
    return override
  }

  // Default for all community-sourced agents
  return 'community'
}

/**
 * Whether the given trust tier allows publishing via PlatformAdapter.publish().
 * Only builtin and verified agents can publish directly.
 */
export function canPublish(trustTier: TrustTier): boolean {
  return TRUST_TIER_CONFIGS[trustTier].allowsPublish
}

/**
 * Whether the given trust tier allows accessing OS keychain credentials.
 * Only builtin and verified agents can access credentials.
 */
export function canAccessCredentials(trustTier: TrustTier): boolean {
  return TRUST_TIER_CONFIGS[trustTier].allowsCredentials
}
