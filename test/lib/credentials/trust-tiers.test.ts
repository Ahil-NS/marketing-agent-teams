import {describe, it, expect} from 'vitest'

import {
  TRUST_TIER_CONFIGS,
  getEffectiveTrustTier,
  canPublish,
  canAccessCredentials,
} from '../../../src/lib/credentials/trust-tiers.js'
import {VALID_SDK_TOOLS} from '../../../src/lib/schemas/agent-schema.js'

describe('trust-tiers', () => {
  describe('TRUST_TIER_CONFIGS', () => {
    it('builtin tier has all SDK tools, credentials, and publish', () => {
      const config = TRUST_TIER_CONFIGS.builtin
      expect(config.allowedTools).toEqual(VALID_SDK_TOOLS)
      expect(config.allowsCredentials).toBe(true)
      expect(config.allowsPublish).toBe(true)
      expect(config.description).toContain('full access')
    })

    it('verified tier has all tools except Bash', () => {
      const config = TRUST_TIER_CONFIGS.verified
      expect(config.allowedTools).not.toContain('Bash')
      expect(config.allowedTools).toContain('WebSearch')
      expect(config.allowedTools).toContain('Write')
      expect(config.allowedTools).toContain('Edit')
      expect(config.allowedTools.length).toBe(VALID_SDK_TOOLS.length - 1)
      expect(config.allowsCredentials).toBe(true)
      expect(config.allowsPublish).toBe(true)
    })

    it('community tier has read-only tools, no credentials, no publish', () => {
      const config = TRUST_TIER_CONFIGS.community
      expect(config.allowedTools).toEqual(['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep'])
      expect(config.allowsCredentials).toBe(false)
      expect(config.allowsPublish).toBe(false)
      expect(config.description).toContain('Unreviewed')
    })

    it('community tier does not include Write, Edit, or Bash', () => {
      const config = TRUST_TIER_CONFIGS.community
      expect(config.allowedTools).not.toContain('Write')
      expect(config.allowedTools).not.toContain('Edit')
      expect(config.allowedTools).not.toContain('Bash')
      expect(config.allowedTools).not.toContain('Task')
    })
  })

  describe('getEffectiveTrustTier', () => {
    it('builtin source always returns builtin, ignoring overrides', () => {
      const overrides = {'some-agent': 'community' as const}
      expect(getEffectiveTrustTier('some-agent', 'builtin', overrides)).toBe('builtin')
    })

    it('builtin source returns builtin even with verified override', () => {
      const overrides = {'core-agent': 'verified' as const}
      expect(getEffectiveTrustTier('core-agent', 'builtin', overrides)).toBe('builtin')
    })

    it('community source defaults to community when no override', () => {
      expect(getEffectiveTrustTier('@community/test-agent', 'community')).toBe('community')
    })

    it('community source defaults to community with empty overrides', () => {
      expect(getEffectiveTrustTier('@community/test-agent', 'community', {})).toBe('community')
    })

    it('community source returns override tier when present', () => {
      const overrides = {'@community/test-agent': 'verified' as const}
      expect(getEffectiveTrustTier('@community/test-agent', 'community', overrides)).toBe('verified')
    })

    it('community source returns community when override is for different agent', () => {
      const overrides = {'@community/other-agent': 'verified' as const}
      expect(getEffectiveTrustTier('@community/test-agent', 'community', overrides)).toBe('community')
    })

    it('returns community when overrides parameter is omitted', () => {
      expect(getEffectiveTrustTier('@community/agent', 'community')).toBe('community')
    })
  })

  describe('canPublish', () => {
    it('returns true for builtin tier', () => {
      expect(canPublish('builtin')).toBe(true)
    })

    it('returns true for verified tier', () => {
      expect(canPublish('verified')).toBe(true)
    })

    it('returns false for community tier', () => {
      expect(canPublish('community')).toBe(false)
    })
  })

  describe('canAccessCredentials', () => {
    it('returns true for builtin tier', () => {
      expect(canAccessCredentials('builtin')).toBe(true)
    })

    it('returns true for verified tier', () => {
      expect(canAccessCredentials('verified')).toBe(true)
    })

    it('returns false for community tier', () => {
      expect(canAccessCredentials('community')).toBe(false)
    })
  })
})
