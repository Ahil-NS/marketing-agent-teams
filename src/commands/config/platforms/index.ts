import { Command, Flags } from '@oclif/core'

import { CredentialManager } from '../../../lib/credentials/index.js'
import { KeytarKeychainAdapter } from '../../../lib/credentials/index.js'
import { AdapterRegistry } from '../../../lib/platforms/adapter-registry.js'
import { PlatformConnectionManager } from '../../../lib/platforms/connection-manager.js'
import type { PlatformConnection, ConnectionHealthResult } from '../../../lib/platforms/connection-manager.js'

export default class PlatformsList extends Command {
  static override description = 'List connected social platforms and their status'

  static override enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> config platforms',
    '<%= config.bin %> config platforms --json',
    '<%= config.bin %> config platforms --check',
  ]

  static override flags = {
    check: Flags.boolean({
      default: false,
      description: 'Run health check on all connected platforms',
    }),
  }

  async run(): Promise<{ platforms: PlatformConnection[] } | { healthChecks: ConnectionHealthResult[] }> {
    const { flags } = await this.parse(PlatformsList)
    const manager = new CredentialManager(new KeytarKeychainAdapter(), process.cwd())
    const registry = new AdapterRegistry()
    const connectionManager = new PlatformConnectionManager(manager, registry)

    if (flags.check) {
      return this.runHealthCheck(connectionManager)
    }

    const connections = await connectionManager.listConnections()

    if (connections.every((c) => c.status === 'not-connected')) {
      this.log('No platforms connected.')
      this.log('Run "mat config platforms add <platform>" to connect a platform.')
      return { platforms: connections }
    }

    // Table header
    this.log('')
    this.log('Platform      Status         Expires            Scopes')
    this.log('──────────    ──────────     ────────────────   ──────')

    for (const conn of connections) {
      const name = conn.platform.padEnd(14)
      const status = this.formatStatus(conn.status).padEnd(15)
      const expiry = conn.expiresAt ? conn.expiresAt.slice(0, 10).padEnd(19) : '—'.padEnd(19)
      const scopes = conn.scopes.length > 0 ? conn.scopes.join(', ') : '—'
      this.log(`${name}${status}${expiry}${scopes}`)
    }

    // Warnings
    this.log('')
    const expiring = connections.filter((c) => c.status === 'expiring')
    const expired = connections.filter((c) => c.status === 'expired')

    for (const c of expiring) {
      this.warn(`${c.platform} token expires soon. Run: mat config platforms add ${c.platform}`)
    }

    for (const c of expired) {
      this.error(`${c.platform} token has expired. Run: mat config platforms add ${c.platform}`, { exit: false })
    }

    return { platforms: connections }
  }

  private async runHealthCheck(connectionManager: PlatformConnectionManager): Promise<{ healthChecks: ConnectionHealthResult[] }> {
    const allPlatforms = ['reddit', 'tiktok', 'facebook', 'instagram'] as const
    const results: ConnectionHealthResult[] = []

    this.log('')
    this.log('Running platform health checks...')
    this.log('')

    for (const platform of allPlatforms) {
      const result = await connectionManager.checkHealth(platform)
      results.push(result)

      const icon = result.healthy ? '✓' : '✗'
      const expiry = result.expiresAt ? result.expiresAt.slice(0, 10) : '—'
      this.log(`${icon} ${platform.padEnd(12)} ${result.status.padEnd(10)} ${expiry}`)

      for (const issue of result.issues) {
        this.log(`  └─ ${issue}`)
      }
    }

    return { healthChecks: results }
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'connected':
        return 'connected'
      case 'expiring':
        return 'expiring'
      case 'expired':
        return 'expired'
      case 'not-connected':
        return 'not connected'
      default:
        return status
    }
  }
}
