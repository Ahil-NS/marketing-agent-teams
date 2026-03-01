import type {TokenData} from '../../credentials/types.js'
import {RedditAuthError, RedditTokenRefreshError} from './errors.js'

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const REDDIT_REVOKE_URL = 'https://www.reddit.com/api/v1/revoke_token'
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Build HTTP Basic Auth header for Reddit token endpoints.
 * Reddit uses base64(client_id:client_secret) for token requests.
 */
export function buildBasicAuthHeader(clientId: string, clientSecret: string): string {
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  return `Basic ${encoded}`
}

/**
 * Build the mandatory User-Agent header for Reddit API calls.
 * Reddit aggressively rate-limits or bans generic user agents.
 */
export function buildUserAgent(appVersion: string, redditUsername?: string): string {
  const username = redditUsername ?? 'marketing-agent-teams'
  return `linux:marketing-agent-teams:${appVersion} (by /u/${username})`
}

/**
 * Check if a token is about to expire (within 5 minutes).
 */
export function isTokenExpiringSoon(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime()
  return Date.now() + TOKEN_REFRESH_BUFFER_MS >= expiryTime
}

/**
 * Exchange an authorization code for Reddit access/refresh tokens.
 * Uses HTTP Basic Auth (base64(client_id:client_secret)) as required by Reddit.
 */
export async function exchangeRedditCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  userAgent: string,
): Promise<TokenData> {
  const response = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': buildBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new RedditAuthError(`Token exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  if (data.error) {
    throw new RedditAuthError(`Token exchange error: ${String(data.error)}`)
  }

  const accessToken = data.access_token as string
  const refreshToken = (data.refresh_token as string) ?? ''
  const expiresIn = (data.expires_in as number) ?? 3600

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}

/**
 * Refresh a Reddit access token using the refresh token.
 * Reddit refresh tokens do NOT rotate — keep using the same one.
 */
export async function refreshRedditToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  userAgent: string,
): Promise<TokenData> {
  const response = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': buildBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new RedditTokenRefreshError(`Refresh failed (HTTP ${response.status}): ${text}`)
  }

  const data = (await response.json()) as Record<string, unknown>
  if (data.error) {
    throw new RedditTokenRefreshError(`Refresh error: ${String(data.error)}`)
  }

  const accessToken = data.access_token as string
  const expiresIn = (data.expires_in as number) ?? 3600

  // Reddit does not return a new refresh token — keep the original
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}

/**
 * Revoke a Reddit token (usually the refresh token on disconnect).
 */
export async function revokeRedditToken(
  token: string,
  tokenTypeHint: 'access_token' | 'refresh_token',
  clientId: string,
  clientSecret: string,
  userAgent: string,
): Promise<void> {
  const response = await fetch(REDDIT_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Authorization': buildBasicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: new URLSearchParams({
      token,
      token_type_hint: tokenTypeHint,
    }),
  })

  // Reddit returns 204 No Content on success, but also accepts 200
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => response.statusText)
    throw new RedditAuthError(`Token revocation failed (HTTP ${response.status}): ${text}`)
  }
}

/**
 * Build the Reddit OAuth authorization URL with duration=permanent.
 */
export function buildRedditAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
    duration: 'permanent',
    scope: scopes.join(','),
  })
  return `https://www.reddit.com/api/v1/authorize?${params.toString()}`
}
