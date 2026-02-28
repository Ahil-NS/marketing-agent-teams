import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getPlatformOAuthConfig, PLATFORM_OAUTH_DEFAULTS } from '../../../src/lib/credentials/platform-oauth-config.js'

describe('PLATFORM_OAUTH_DEFAULTS', () => {
  it('has defaults for all 4 platforms', () => {
    expect(PLATFORM_OAUTH_DEFAULTS.reddit).toBeDefined()
    expect(PLATFORM_OAUTH_DEFAULTS.tiktok).toBeDefined()
    expect(PLATFORM_OAUTH_DEFAULTS.facebook).toBeDefined()
    expect(PLATFORM_OAUTH_DEFAULTS.instagram).toBeDefined()
  })

  it('each platform has authorizationUrl, tokenUrl, and scopes', () => {
    for (const platform of ['reddit', 'tiktok', 'facebook', 'instagram'] as const) {
      const config = PLATFORM_OAUTH_DEFAULTS[platform]
      expect(config.authorizationUrl).toMatch(/^https:\/\//)
      expect(config.tokenUrl).toMatch(/^https:\/\//)
      expect(config.scopes.length).toBeGreaterThan(0)
    }
  })
})

describe('getPlatformOAuthConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns null when env vars not set', () => {
    delete process.env.MAT_REDDIT_CLIENT_ID
    delete process.env.MAT_REDDIT_CLIENT_SECRET
    expect(getPlatformOAuthConfig('reddit')).toBeNull()
  })

  it('returns null when only client ID is set', () => {
    process.env.MAT_REDDIT_CLIENT_ID = 'test-id'
    delete process.env.MAT_REDDIT_CLIENT_SECRET
    expect(getPlatformOAuthConfig('reddit')).toBeNull()
  })

  it('returns config when both env vars are set', () => {
    process.env.MAT_REDDIT_CLIENT_ID = 'test-id'
    process.env.MAT_REDDIT_CLIENT_SECRET = 'test-secret'

    const result = getPlatformOAuthConfig('reddit')
    expect(result).not.toBeNull()
    expect(result!.clientId).toBe('test-id')
    expect(result!.clientSecret).toBe('test-secret')
    expect(result!.config.clientId).toBe('test-id')
    expect(result!.config.authorizationUrl).toBe(PLATFORM_OAUTH_DEFAULTS.reddit.authorizationUrl)
  })

  it('uses correct env var prefix for each platform', () => {
    process.env.MAT_TIKTOK_CLIENT_ID = 'tt-id'
    process.env.MAT_TIKTOK_CLIENT_SECRET = 'tt-secret'

    const result = getPlatformOAuthConfig('tiktok')
    expect(result).not.toBeNull()
    expect(result!.clientId).toBe('tt-id')
  })
})
