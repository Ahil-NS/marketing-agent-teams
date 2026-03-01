import { Args, Command } from '@oclif/core'

import {
  CredentialManager,
  KeytarKeychainAdapter,
  OAuthFlowHandler,
  PlatformValidator,
  SUPPORTED_PLATFORMS,
} from '../../../lib/credentials/index.js'
import type { Platform } from '../../../lib/credentials/index.js'
import { getPlatformOAuthConfig, PLATFORM_OAUTH_DEFAULTS } from '../../../lib/credentials/platform-oauth-config.js'

export default class PlatformsAdd extends Command {
  static override description = 'Connect a social platform via OAuth'

  static override args = {
    platform: Args.string({
      description: 'Platform to connect',
      required: true,
      options: [...SUPPORTED_PLATFORMS],
    }),
  }

  static override examples = [
    '<%= config.bin %> config platforms add reddit',
    '<%= config.bin %> config platforms add tiktok',
  ]

  async run(): Promise<void> {
    const { args } = await this.parse(PlatformsAdd)
    const platform = args.platform as Platform

    const oauthSettings = getPlatformOAuthConfig(platform)
    if (!oauthSettings) {
      const envPrefix = `MAT_${platform.toUpperCase()}`
      this.log(`To connect ${platform}, you need to configure OAuth credentials first.`)
      this.log(`1. Register an app at the ${platform} developer portal`)
      this.log(`2. Set environment variables:`)
      this.log(`   ${envPrefix}_CLIENT_ID=<your-client-id>`)
      this.log(`   ${envPrefix}_CLIENT_SECRET=<your-client-secret>`)
      this.log(`3. Re-run this command to initiate the OAuth flow`)
      return
    }

    const handler = new OAuthFlowHandler(platform, oauthSettings.config)

    this.log(`Starting OAuth flow for ${platform}...`)
    await handler.startCallbackServer()
    const authUrl = handler.getAuthorizationUrl()
    this.log(`Open this URL in your browser to authorize:\n${authUrl}`)
    this.log('Waiting for authorization (5 minute timeout)...')

    try {
      const code = await handler.waitForCodeWithTimeout()
      this.log('Authorization code received. Exchanging for tokens...')

      const tokens = await handler.exchangeCode(code, oauthSettings.clientSecret)
      const defaults = PLATFORM_OAUTH_DEFAULTS[platform]

      const manager = new CredentialManager(new KeytarKeychainAdapter(), process.cwd())
      await manager.store(platform, tokens, defaults.scopes)
      this.log('Tokens stored securely. Validating connection...')

      const validator = new PlatformValidator()
      const result = await validator.validate(platform, tokens.accessToken)

      if (result.success) {
        this.log(`${platform} connected successfully! Token expires at ${tokens.expiresAt}.`)
      } else {
        this.log(`Warning: ${platform} credentials stored but validation failed: ${result.error}`)
      }
    } finally {
      await handler.stopServer()
    }
  }
}
