import type { AuthResult, Platform } from './types.js'

interface PlatformEndpoint {
  url: string
  method: string
}

const PLATFORM_ENDPOINTS: Record<Platform, PlatformEndpoint> = {
  reddit: {
    url: 'https://oauth.reddit.com/api/v1/me',
    method: 'GET',
  },
  tiktok: {
    url: 'https://open.tiktokapis.com/v2/user/info/',
    method: 'GET',
  },
  facebook: {
    url: 'https://graph.facebook.com/v19.0/me',
    method: 'GET',
  },
  instagram: {
    url: 'https://graph.instagram.com/me?fields=id,username',
    method: 'GET',
  },
}

export class PlatformValidator {
  async validate(platform: Platform, accessToken: string): Promise<AuthResult> {
    const endpoint = PLATFORM_ENDPOINTS[platform]

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'marketing-agent-teams/0.1.0',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          platform,
          error: `${platform} API returned ${response.status} ${response.statusText}. Check that your OAuth token has the required scopes and has not expired.`,
        }
      }

      return { success: true, platform }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        platform,
        error: `Failed to connect to ${platform}: ${message}. Check your network connection and try again.`,
      }
    }
  }
}
