import { describe, expect, it } from 'vitest'

import { platformCredentialSchema, platformsMetadataSchema } from '../../../src/lib/schemas/platform-schema.js'

describe('platformCredentialSchema', () => {
  it('validates a complete platform credential entry', () => {
    const result = platformCredentialSchema.safeParse({
      platform: 'reddit',
      connected: true,
      expiresAt: '2026-04-01T00:00:00Z',
      scopes: ['read', 'submit'],
      connectedAt: '2026-02-28T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('validates with optional fields omitted', () => {
    const result = platformCredentialSchema.safeParse({
      platform: 'tiktok',
      connected: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scopes).toEqual([])
    }
  })

  it('rejects unsupported platform', () => {
    const result = platformCredentialSchema.safeParse({
      platform: 'twitter',
      connected: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime format', () => {
    const result = platformCredentialSchema.safeParse({
      platform: 'reddit',
      connected: true,
      expiresAt: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('validates all 4 supported platforms', () => {
    for (const platform of ['reddit', 'tiktok', 'facebook', 'instagram']) {
      const result = platformCredentialSchema.safeParse({ platform, connected: true })
      expect(result.success).toBe(true)
    }
  })
})

describe('platformsMetadataSchema', () => {
  it('validates empty platforms array', () => {
    const result = platformsMetadataSchema.safeParse({ platforms: [] })
    expect(result.success).toBe(true)
  })

  it('defaults to empty platforms array', () => {
    const result = platformsMetadataSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.platforms).toEqual([])
    }
  })

  it('validates multiple platforms', () => {
    const result = platformsMetadataSchema.safeParse({
      platforms: [
        { platform: 'reddit', connected: true, scopes: ['read'] },
        { platform: 'facebook', connected: false },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.platforms).toHaveLength(2)
    }
  })

  it('NEVER contains token fields', () => {
    // Verify schema shape doesn't accept token-like fields
    const result = platformsMetadataSchema.safeParse({
      platforms: [
        {
          platform: 'reddit',
          connected: true,
          accessToken: 'should-not-exist',
          refreshToken: 'should-not-exist',
        },
      ],
    })
    // Zod strips unknown keys by default
    if (result.success) {
      const serialized = JSON.stringify(result.data)
      expect(serialized).not.toContain('accessToken')
      expect(serialized).not.toContain('refreshToken')
    }
  })
})
