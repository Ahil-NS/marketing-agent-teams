import type {TokenData} from '../../credentials/types.js'
import {TikTokAuthError, TikTokTokenRefreshError} from './errors.js'
import {tiktokTokenResponseSchema, TIKTOK_API_BASE} from './tiktok-types.js'

const TIKTOK_TOKEN_URL = `${TIKTOK_API_BASE}/v2/oauth/token/`
const TIKTOK_REVOKE_URL = `${TIKTOK_API_BASE}/v2/oauth/revoke/`
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Check if a token is about to expire (within 5 minutes).
 */
export function isTokenExpiringSoon(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime()
  return Date.now() + TOKEN_REFRESH_BUFFER_MS >= expiryTime
}

/**
 * Build TikTok authorization URL.
 * TikTok uses `client_key` (not `client_id`) and comma-separated scopes.
 */
export function buildTikTokAuthorizationUrl(
  clientKey: string,
  redirectUri: string,
  state: string,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`
}

/**
 * Exchange an authorization code for TikTok access/refresh tokens.
 * TikTok uses form-urlencoded with `client_key` and `client_secret` in the body.
 */
export async function exchangeTikTokCode(
  code: string,
  redirectUri: string,
  clientKey: string,
  clientSecret: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<TokenData & {openId: string}> {
  const response = await fetchFn(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new TikTokAuthError(`Token exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = tiktokTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new TikTokAuthError(`Invalid token response: ${parsed.error.message}`)
  }

  const tokenData = parsed.data

  if (tokenData.access_token === '') {
    throw new TikTokAuthError('Token exchange returned empty access token')
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    openId: tokenData.open_id,
  }
}

/**
 * Refresh a TikTok access token using the refresh token.
 * TikTok may ROTATE the refresh token — always persist the returned one.
 */
export async function refreshTikTokToken(
  refreshToken: string,
  clientKey: string,
  clientSecret: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<TokenData> {
  const response = await fetchFn(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new TikTokTokenRefreshError(`Refresh failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = tiktokTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new TikTokTokenRefreshError(`Invalid refresh response: ${parsed.error.message}`)
  }

  const tokenData = parsed.data

  // TikTok may rotate the refresh token — always return and persist the new one
  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  }
}

/**
 * Revoke a TikTok token.
 */
export async function revokeTikTokToken(
  token: string,
  clientKey: string,
  clientSecret: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  const response = await fetchFn(TIKTOK_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      token,
    }),
  })

  if (!response.ok && response.status !== 200) {
    const text = await response.text().catch(() => response.statusText)
    throw new TikTokAuthError(`Token revocation failed (HTTP ${response.status}): ${text}`)
  }
}
