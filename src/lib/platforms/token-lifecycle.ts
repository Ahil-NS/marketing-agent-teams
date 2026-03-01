import type {CredentialManager} from '../credentials/credential-manager.js'
import type {PlatformName} from './types.js'
import type {PlatformConnectionManager, TokenRefreshResult} from './connection-manager.js'

/** Platform-specific refresh window in days (NFR19) */
export const REFRESH_WINDOWS: Record<PlatformName, number> = {
  reddit: 7,
  tiktok: 7,
  facebook: 7,
  instagram: 14, // Instagram has 60-day token lifetime — check 14 days before
}

/** Token nearing expiry */
export interface ExpiringToken {
  platform: PlatformName
  expiresAt: string
  daysUntilExpiry: number
  refreshWindowDays: number
}

/** Summary of token refresh operations */
export interface TokenRefreshSummary {
  refreshed: PlatformName[]
  failed: Array<{
    platform: PlatformName
    error: string
    reAuthCommand: string
  }>
}

/**
 * Manages the lifecycle of platform OAuth tokens.
 *
 * On pipeline start (prerun hook), scans stored credentials for tokens
 * that are within their refresh window and attempts automatic renewal.
 * Uses platform-specific warning windows: 7 days default, 14 days for Instagram.
 */
export class TokenLifecycleManager {
  constructor(
    private readonly credentialManager: CredentialManager,
    private readonly connectionManager: PlatformConnectionManager,
  ) {}

  /**
   * Scan stored credentials for tokens within their refresh window (AC4).
   */
  async checkExpiringTokens(now?: Date): Promise<ExpiringToken[]> {
    const platforms = await this.credentialManager.list()
    const currentTime = now ?? new Date()
    const expiring: ExpiringToken[] = []

    for (const platform of platforms) {
      if (!platform.connected || !platform.expiresAt) continue

      const expiresAt = new Date(platform.expiresAt)
      const daysUntilExpiry = (expiresAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
      const refreshWindow = REFRESH_WINDOWS[platform.platform as PlatformName] ?? 7

      if (daysUntilExpiry <= refreshWindow) {
        expiring.push({
          platform: platform.platform as PlatformName,
          expiresAt: platform.expiresAt,
          daysUntilExpiry: Math.max(0, daysUntilExpiry),
          refreshWindowDays: refreshWindow,
        })
      }
    }

    return expiring
  }

  /**
   * Attempt to refresh all expiring tokens (AC4).
   *
   * - Successful refreshes update token metadata silently
   * - Failed refreshes return error with re-auth command
   * - NEVER halts the pipeline — callers should warn but continue
   */
  async refreshExpiringTokens(now?: Date): Promise<TokenRefreshSummary> {
    const expiring = await this.checkExpiringTokens(now)
    const summary: TokenRefreshSummary = {
      refreshed: [],
      failed: [],
    }

    for (const token of expiring) {
      const result: TokenRefreshResult = await this.connectionManager.refreshToken(token.platform, now)
      if (result.success) {
        summary.refreshed.push(token.platform)
      } else {
        summary.failed.push({
          platform: token.platform,
          error: result.error ?? 'Unknown error',
          reAuthCommand: result.reAuthCommand ?? `mat config platforms add ${token.platform}`,
        })
      }
    }

    return summary
  }
}
