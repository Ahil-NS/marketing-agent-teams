import type {CredentialManager} from '../credentials/credential-manager.js'
import type {PlatformCredential} from '../credentials/types.js'
import {CredentialNotFoundError} from '../credentials/errors.js'
import {MATError} from '../utils/errors.js'
import type {AdapterRegistry} from './adapter-registry.js'
import type {PlatformName} from './types.js'
import {RetryQueue} from './retry-queue/index.js'

/** Connection statuses for a platform */
export type ConnectionStatus = 'connected' | 'expiring' | 'expired' | 'not-connected'

/** Represents the connection state of a single platform */
export interface PlatformConnection {
  platform: PlatformName
  status: ConnectionStatus
  expiresAt?: string
  scopes: string[]
  lastRefreshedAt?: string
}

/** Result of a token refresh attempt */
export interface TokenRefreshResult {
  success: boolean
  platform: PlatformName
  newExpiresAt?: string
  error?: string
  reAuthCommand?: string
}

/** Result of a connection health check */
export interface ConnectionHealthResult {
  platform: PlatformName
  healthy: boolean
  status: 'healthy' | 'expired' | 'expiring' | 'invalid'
  expiresAt?: string
  issues: string[]
}

/** Summary of platform connection status for `mat status` */
export interface PlatformConnectionStatus {
  platform: PlatformName
  status: ConnectionStatus
  expiresAt?: string
  scopeCount: number
  warningMessage?: string
}

/** Default expiry warning window in days */
const DEFAULT_EXPIRY_WARNING_DAYS = 7
/** Instagram has a longer warning window (60-day token lifetime) */
const INSTAGRAM_EXPIRY_WARNING_DAYS = 14

export class PlatformConnectionNotFoundError extends MATError {
  constructor(platform: string) {
    super(
      `Platform '${platform}' is not connected`,
      'PLATFORM_CONNECTION_NOT_FOUND',
      `No connection exists for platform '${platform}'`,
      `Run 'mat config platforms add ${platform}' to connect`,
      'platforms',
      'permanent',
    )
  }
}

export class PlatformConnectionError extends MATError {
  constructor(platform: string, detail: string) {
    super(
      `Platform connection error for '${platform}': ${detail}`,
      'PLATFORM_CONNECTION_ERROR',
      `Could not manage connection for '${platform}'`,
      `Check platform configuration and try again`,
      'platforms',
      'transient',
    )
  }
}

/**
 * Manages platform connections — list, remove, refresh, and health check.
 *
 * Tokens are NEVER stored locally; only metadata (expiry, scopes, timestamps)
 * is persisted in `.mat/credentials/platforms.json`. Actual tokens live in
 * the OS keychain via the CredentialManager.
 */
export class PlatformConnectionManager {
  constructor(
    private readonly credentialManager: CredentialManager,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly retryQueue?: RetryQueue,
  ) {}

  /**
   * List all platform connections with computed status (AC1).
   * Platforms with no stored credentials show as "not-connected".
   */
  async listConnections(now?: Date): Promise<PlatformConnection[]> {
    const allPlatforms: PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram']
    const storedPlatforms = await this.credentialManager.list()

    const connections: PlatformConnection[] = []
    for (const platform of allPlatforms) {
      const stored = storedPlatforms.find((p) => p.platform === platform)
      if (!stored || !stored.connected) {
        connections.push({
          platform,
          status: 'not-connected',
          scopes: [],
        })
        continue
      }

      connections.push(this.buildConnection(platform, stored, now))
    }

    return connections
  }

  /**
   * Remove a platform connection (AC2).
   * Deletes tokens from keychain, removes metadata, and deregisters adapter.
   */
  async removeConnection(platform: PlatformName): Promise<void> {
    try {
      await this.credentialManager.remove(platform)
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        throw new PlatformConnectionNotFoundError(platform)
      }

      throw error
    }

    // Deregister adapter if registered
    if (this.adapterRegistry.has(platform)) {
      this.adapterRegistry.unregister(platform)
    }
  }

  /**
   * Attempt token refresh for a platform (AC3, AC4).
   * Delegates to the platform adapter's authenticate() method.
   * On success after re-auth, re-enables retry queue items for the platform.
   */
  async refreshToken(platform: PlatformName, now?: Date): Promise<TokenRefreshResult> {
    if (!this.adapterRegistry.has(platform)) {
      return {
        success: false,
        platform,
        error: `No adapter registered for '${platform}'`,
        reAuthCommand: `mat config platforms add ${platform}`,
      }
    }

    const adapter = this.adapterRegistry.get(platform)
    try {
      const result = await adapter.authenticate()
      if (!result.success) {
        return {
          success: false,
          platform,
          error: result.error ?? 'Authentication failed',
          reAuthCommand: `mat config platforms add ${platform}`,
        }
      }

      // Update stored metadata with new expiry
      const storedPlatforms = await this.credentialManager.list()
      const stored = storedPlatforms.find((p) => p.platform === platform)
      if (stored) {
        await this.credentialManager.store(
          platform,
          {
            accessToken: 'refreshed',
            refreshToken: 'refreshed',
            expiresAt: result.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          result.scopes,
        )
      }

      // Re-enable retry queue items for this platform (AC3 - Story 6.5 integration)
      if (this.retryQueue) {
        await this.reEnableRetryItems(platform, now)
      }

      return {
        success: true,
        platform,
        newExpiresAt: result.expiresAt,
      }
    } catch (error) {
      return {
        success: false,
        platform,
        error: error instanceof Error ? error.message : String(error),
        reAuthCommand: `mat config platforms add ${platform}`,
      }
    }
  }

  /**
   * Validate a platform connection by calling adapter.authenticate() in verify mode (AC5).
   */
  async checkHealth(platform: PlatformName, now?: Date): Promise<ConnectionHealthResult> {
    const storedPlatforms = await this.credentialManager.list()
    const stored = storedPlatforms.find((p) => p.platform === platform)

    if (!stored || !stored.connected) {
      return {
        platform,
        healthy: false,
        status: 'invalid',
        issues: [`Platform '${platform}' is not connected`],
      }
    }

    const issues: string[] = []

    // Check token expiry
    if (stored.expiresAt) {
      const currentTime = now ?? new Date()
      const expiresAt = new Date(stored.expiresAt)
      const daysUntilExpiry = (expiresAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
      const warningDays = platform === 'instagram' ? INSTAGRAM_EXPIRY_WARNING_DAYS : DEFAULT_EXPIRY_WARNING_DAYS

      if (daysUntilExpiry <= 0) {
        return {
          platform,
          healthy: false,
          status: 'expired',
          expiresAt: stored.expiresAt,
          issues: [`Token expired on ${stored.expiresAt}`],
        }
      }

      if (daysUntilExpiry <= warningDays) {
        issues.push(`Token expires in ${Math.ceil(daysUntilExpiry)} days`)
      }
    }

    // Validate via adapter if registered
    if (this.adapterRegistry.has(platform)) {
      try {
        const adapter = this.adapterRegistry.get(platform)
        const authResult = await adapter.authenticate()
        if (!authResult.success) {
          return {
            platform,
            healthy: false,
            status: 'invalid',
            expiresAt: stored.expiresAt,
            issues: [...issues, `Authentication validation failed: ${authResult.error ?? 'Unknown error'}`],
          }
        }
      } catch (error) {
        return {
          platform,
          healthy: false,
          status: 'invalid',
          expiresAt: stored.expiresAt,
          issues: [...issues, `Health check failed: ${error instanceof Error ? error.message : String(error)}`],
        }
      }
    }

    if (issues.length > 0) {
      return {
        platform,
        healthy: true,
        status: 'expiring',
        expiresAt: stored.expiresAt,
        issues,
      }
    }

    return {
      platform,
      healthy: true,
      status: 'healthy',
      expiresAt: stored.expiresAt,
      issues: [],
    }
  }

  /**
   * Get connection status for all platforms for `mat status` (AC6).
   */
  async getPlatformConnectionStatus(now?: Date): Promise<PlatformConnectionStatus[]> {
    const connections = await this.listConnections(now)
    return connections.map((conn) => {
      let warningMessage: string | undefined
      if (conn.status === 'expiring') {
        warningMessage = `Token expiring soon. Run: mat config platforms add ${conn.platform}`
      } else if (conn.status === 'expired') {
        warningMessage = `Token expired. Run: mat config platforms add ${conn.platform}`
      }

      return {
        platform: conn.platform,
        status: conn.status,
        expiresAt: conn.expiresAt,
        scopeCount: conn.scopes.length,
        warningMessage,
      }
    })
  }

  // --- Internal helpers ---

  private buildConnection(
    platform: PlatformName,
    stored: PlatformCredential,
    now?: Date,
  ): PlatformConnection {
    const currentTime = now ?? new Date()
    let status: ConnectionStatus = 'connected'

    if (stored.expiresAt) {
      const expiresAt = new Date(stored.expiresAt)
      const daysUntilExpiry = (expiresAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)
      const warningDays = platform === 'instagram' ? INSTAGRAM_EXPIRY_WARNING_DAYS : DEFAULT_EXPIRY_WARNING_DAYS

      if (daysUntilExpiry <= 0) {
        status = 'expired'
      } else if (daysUntilExpiry <= warningDays) {
        status = 'expiring'
      }
    }

    return {
      platform,
      status,
      expiresAt: stored.expiresAt,
      scopes: stored.scopes ?? [],
      lastRefreshedAt: stored.connectedAt,
    }
  }

  /**
   * Re-enable retry queue items for a platform after successful re-authentication (AC3).
   * Resets nextRetryAt to make items eligible for immediate retry.
   */
  private async reEnableRetryItems(platform: PlatformName, now?: Date): Promise<number> {
    if (!this.retryQueue) return 0

    const items = await this.retryQueue.loadAll()
    const platformItems = items.filter(
      (item) => item.platform === platform && item.state === 'pending',
    )

    let reEnabled = 0
    const currentTime = (now ?? new Date()).toISOString()

    for (const item of platformItems) {
      // Reset nextRetryAt to now to make eligible for immediate retry
      const updated = {...item, nextRetryAt: currentTime}
      // Write updated item back. We access the queue dir via loadAll + atomicWrite pattern
      // The retry queue's processRetries will pick these up on next run
      try {
        const {writeFile} = await import('node:fs/promises')
        const {join} = await import('node:path')
        const queueDir = join(process.cwd(), '.mat', 'state', 'retry-queue')
        const filePath = join(queueDir, `${item.itemId}.json`)
        await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')
        reEnabled++
      } catch {
        // Skip items that can't be updated — don't block re-auth flow
      }
    }

    return reEnabled
  }
}
