import {CredentialManager} from './credential-manager.js'
import {KeytarKeychainAdapter} from './keychain-adapter.js'
import type {Platform} from './types.js'

const REFRESH_WINDOW_DAYS = 7
const INSTAGRAM_REFRESH_WINDOW_DAYS = 14

export type TokenRefreshStatus = 'refreshed' | 'skipped' | 'failed'

export async function refreshExpiredTokens(
  projectRoot: string,
): Promise<Record<string, TokenRefreshStatus>> {
  const manager = new CredentialManager(new KeytarKeychainAdapter(), projectRoot)
  const platforms = await manager.list()
  const results: Record<string, TokenRefreshStatus> = {}

  for (const platform of platforms) {
    if (!platform.expiresAt) {
      results[platform.platform] = 'skipped'
      continue
    }

    const windowDays = platform.platform === 'instagram'
      ? INSTAGRAM_REFRESH_WINDOW_DAYS
      : REFRESH_WINDOW_DAYS

    const expiresAt = new Date(platform.expiresAt)
    const now = new Date()
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    if (daysUntilExpiry > windowDays) {
      results[platform.platform] = 'skipped'
      continue
    }

    try {
      await refreshPlatformToken(manager, platform.platform)
      results[platform.platform] = 'refreshed'
    } catch {
      results[platform.platform] = 'failed'
    }
  }

  return results
}

async function refreshPlatformToken(
  manager: CredentialManager,
  platform: Platform,
): Promise<void> {
  // Get existing token from keychain
  const entry = await manager.retrieve(platform)
  if (!entry.tokens.refreshToken) return

  // Platform-specific refresh endpoints
  // Implementation deferred to platform adapter stories (Epic 6)
  // For now, throw to indicate refresh is not yet implemented
  throw new Error(`Token refresh not yet implemented for ${platform}`)
}
