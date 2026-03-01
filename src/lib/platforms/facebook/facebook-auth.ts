import type {TokenData} from '../../credentials/types.js'
import {FacebookAuthError, FacebookTokenExchangeError} from './errors.js'
import {
  GRAPH_API_BASE,
  facebookMeAccountsSchema,
  facebookTokenResponseSchema,
} from './facebook-types.js'
import type {FacebookPage} from './facebook-types.js'

const FACEBOOK_OAUTH_BASE = 'https://www.facebook.com/v24.0/dialog/oauth'

/**
 * Build the Facebook OAuth authorization URL.
 */
export function buildFacebookAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(','),
    response_type: 'code',
  })
  return `${FACEBOOK_OAUTH_BASE}?${params.toString()}`
}

/**
 * Exchange an authorization code for a short-lived user access token (1 hour).
 * Step 1 of the Facebook token chain.
 */
export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  })

  const response = await fetchFn(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`)

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new FacebookAuthError(`Code exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new FacebookAuthError('Invalid token response from Facebook')
  }

  return parsed.data.access_token
}

/**
 * Exchange a short-lived user token for a long-lived user token (60 days).
 * Step 2 of the Facebook token chain.
 *
 * Uses: GET /oauth/access_token?grant_type=fb_exchange_token&client_id={id}&client_secret={secret}&fb_exchange_token={token}
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<{accessToken: string; expiresIn: number}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetchFn(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`)

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new FacebookTokenExchangeError(`Long-lived token exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new FacebookTokenExchangeError('Invalid token response from Facebook')
  }

  return {
    accessToken: parsed.data.access_token,
    expiresIn: parsed.data.expires_in ?? 5_184_000, // default 60 days
  }
}

/**
 * Retrieve Page Access Tokens using a long-lived user token.
 * Step 3 of the Facebook token chain.
 *
 * Page Access Tokens derived from long-lived user tokens are NEVER-EXPIRING.
 * Uses: GET /me/accounts
 */
export async function getPageAccessTokens(
  longLivedUserToken: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<FacebookPage[]> {
  const params = new URLSearchParams({
    access_token: longLivedUserToken,
  })

  const response = await fetchFn(`${GRAPH_API_BASE}/me/accounts?${params.toString()}`)

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new FacebookTokenExchangeError(`Failed to retrieve Page tokens (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookMeAccountsSchema.safeParse(data)
  if (!parsed.success) {
    throw new FacebookTokenExchangeError('Invalid /me/accounts response from Facebook')
  }

  return parsed.data.data
}

/**
 * Execute the full Facebook token chain:
 * Authorization code → Short-lived user token → Long-lived user token → Page Access Tokens
 *
 * Returns TokenData with the Page Access Token (never-expiring) for the selected page.
 */
export async function executeFacebookTokenChain(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  pageId: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<TokenData> {
  // Step 1: Exchange code for short-lived user token
  const shortLivedToken = await exchangeFacebookCode(code, redirectUri, clientId, clientSecret, fetchFn)

  // Step 2: Exchange for long-lived user token (60 days)
  const {accessToken: longLivedToken} = await exchangeForLongLivedToken(shortLivedToken, clientId, clientSecret, fetchFn)

  // Step 3: Get Page Access Tokens
  const pages = await getPageAccessTokens(longLivedToken, fetchFn)
  const selectedPage = pages.find((p) => p.id === pageId)
  if (!selectedPage) {
    throw new FacebookTokenExchangeError(`Page '${pageId}' not found in authorized Pages`)
  }

  // Page Access Tokens from long-lived user tokens are never-expiring
  // Set a far-future expiry to satisfy TokenData interface
  return {
    accessToken: selectedPage.access_token,
    refreshToken: '', // Not applicable — Page tokens don't refresh
    expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // ~100 years
  }
}
