import type { Platform } from './types.js'
import type { OAuthPlatformConfig } from './oauth-server.js'

type PlatformOAuthDefaults = Omit<OAuthPlatformConfig, 'clientId'>

export const PLATFORM_OAUTH_DEFAULTS: Record<Platform, PlatformOAuthDefaults> = {
  reddit: {
    authorizationUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    scopes: ['identity', 'read', 'submit', 'flair'],
  },
  tiktok: {
    authorizationUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['video.publish', 'user.info.basic'],
  },
  facebook: {
    authorizationUrl: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v24.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
  },
  instagram: {
    authorizationUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
  },
}

export function getPlatformOAuthConfig(
  platform: Platform,
): { clientId: string; clientSecret: string; config: OAuthPlatformConfig } | null {
  const envPrefix = `MAT_${platform.toUpperCase()}`
  const clientId = process.env[`${envPrefix}_CLIENT_ID`]
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`]

  if (!clientId || !clientSecret) {
    return null
  }

  const defaults = PLATFORM_OAUTH_DEFAULTS[platform]
  return {
    clientId,
    clientSecret,
    config: { ...defaults, clientId },
  }
}
