import { Command } from '@oclif/core'

import { CredentialManager } from '../../../lib/credentials/index.js'
import { KeytarKeychainAdapter } from '../../../lib/credentials/index.js'

export default class PlatformsList extends Command {
  static override description = 'List connected social platforms and their status'

  static override enableJsonFlag = true

  static override examples = [
    '<%= config.bin %> config platforms',
    '<%= config.bin %> config platforms --json',
  ]

  async run(): Promise<{ platforms: Array<{ platform: string; connected: boolean; scopes: string[]; expiresAt?: string; connectedAt?: string }> }> {
    const manager = new CredentialManager(new KeytarKeychainAdapter(), process.cwd())
    const platforms = await manager.list()

    if (platforms.length === 0) {
      this.log('No platforms connected.')
      this.log('Run "mat config platforms add <platform>" to connect a platform.')
      return { platforms: [] }
    }

    for (const p of platforms) {
      const status = p.connected ? 'connected' : 'disconnected'
      const expiry = p.expiresAt ? ` (expires: ${p.expiresAt})` : ''
      this.log(`  ${p.platform}: ${status}${expiry}`)
    }

    return { platforms }
  }
}
