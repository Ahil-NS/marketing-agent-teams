import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import type {PlatformCredential} from '../../../src/lib/credentials/types.js'

// Mock keytar native module
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}))

// Mock CredentialManager — must be a proper class for `new` usage
const mockList = vi.fn()
const mockRetrieve = vi.fn()

vi.mock('../../../src/lib/credentials/credential-manager.js', () => {
  return {
    CredentialManager: class MockCredentialManager {
      list = mockList
      retrieve = mockRetrieve
      store = vi.fn()
    },
  }
})

vi.mock('../../../src/lib/credentials/keychain-adapter.js', () => {
  return {
    KeytarKeychainAdapter: class MockKeychainAdapter {
      setPassword = vi.fn()
      getPassword = vi.fn()
      deletePassword = vi.fn()
    },
  }
})

describe('token-refresher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const futureDays = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  it('skips platforms with tokens expiring far in the future', async () => {
    const platforms: PlatformCredential[] = [{
      platform: 'reddit',
      connected: true,
      expiresAt: futureDays(30),
      scopes: ['read'],
      connectedAt: new Date().toISOString(),
    }]
    mockList.mockResolvedValue(platforms)

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result.reddit).toBe('skipped')
    expect(mockRetrieve).not.toHaveBeenCalled()
  })

  it('attempts refresh for tokens expiring within 7 days', async () => {
    const platforms: PlatformCredential[] = [{
      platform: 'reddit',
      connected: true,
      expiresAt: futureDays(5),
      scopes: ['read'],
      connectedAt: new Date().toISOString(),
    }]
    mockList.mockResolvedValue(platforms)
    mockRetrieve.mockResolvedValue({
      platform: 'reddit',
      tokens: {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDays(5),
      },
    })

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    // Refresh not yet implemented → fails gracefully
    expect(result.reddit).toBe('failed')
  })

  it('uses 14-day window for Instagram', async () => {
    const platforms: PlatformCredential[] = [{
      platform: 'instagram',
      connected: true,
      expiresAt: futureDays(10),
      scopes: ['basic'],
      connectedAt: new Date().toISOString(),
    }]
    mockList.mockResolvedValue(platforms)
    mockRetrieve.mockResolvedValue({
      platform: 'instagram',
      tokens: {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: futureDays(10),
      },
    })

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result.instagram).toBe('failed')
  })

  it('skips non-Instagram platform tokens expiring in 10 days', async () => {
    const platforms: PlatformCredential[] = [{
      platform: 'facebook',
      connected: true,
      expiresAt: futureDays(10),
      scopes: ['pages'],
      connectedAt: new Date().toISOString(),
    }]
    mockList.mockResolvedValue(platforms)

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result.facebook).toBe('skipped')
  })

  it('handles multiple platforms with mixed expiry states', async () => {
    const platforms: PlatformCredential[] = [
      {
        platform: 'reddit',
        connected: true,
        expiresAt: futureDays(3),
        scopes: ['read'],
        connectedAt: new Date().toISOString(),
      },
      {
        platform: 'facebook',
        connected: true,
        expiresAt: futureDays(20),
        scopes: ['pages'],
        connectedAt: new Date().toISOString(),
      },
    ]
    mockList.mockResolvedValue(platforms)
    mockRetrieve.mockResolvedValue({
      platform: 'reddit',
      tokens: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: futureDays(3),
      },
    })

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result.reddit).toBe('failed')
    expect(result.facebook).toBe('skipped')
  })

  it('returns empty object when no platforms configured', async () => {
    mockList.mockResolvedValue([])

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result).toEqual({})
  })

  it('handles platforms without expiresAt gracefully', async () => {
    const platforms: PlatformCredential[] = [{
      platform: 'tiktok',
      connected: true,
      scopes: [],
      connectedAt: new Date().toISOString(),
    }]
    mockList.mockResolvedValue(platforms)

    const {refreshExpiredTokens} = await import('../../../src/lib/credentials/token-refresher.js')
    const result = await refreshExpiredTokens('/fake/root')

    expect(result.tiktok).toBe('skipped')
  })
})
