import { Args, Command } from '@oclif/core'

import { CredentialManager, SUPPORTED_PLATFORMS } from '../../../lib/credentials/index.js'
import { KeytarKeychainAdapter } from '../../../lib/credentials/index.js'
import { CredentialNotFoundError } from '../../../lib/credentials/index.js'
import type { Platform } from '../../../lib/credentials/index.js'

export default class PlatformsRemove extends Command {
  static override description = 'Remove a connected social platform and delete its credentials'

  static override args = {
    platform: Args.string({
      description: 'Platform to disconnect',
      required: true,
      options: [...SUPPORTED_PLATFORMS],
    }),
  }

  static override examples = [
    '<%= config.bin %> config platforms remove reddit',
  ]

  async run(): Promise<void> {
    const { args } = await this.parse(PlatformsRemove)
    const platform = args.platform as Platform

    const manager = new CredentialManager(new KeytarKeychainAdapter(), process.cwd())

    try {
      await manager.remove(platform)
      this.log(`Removed ${platform} credentials. Platform disconnected.`)
    } catch (error) {
      if (error instanceof CredentialNotFoundError) {
        this.log(`Platform "${platform}" is not connected.`)
      } else {
        throw error
      }
    }
  }
}
