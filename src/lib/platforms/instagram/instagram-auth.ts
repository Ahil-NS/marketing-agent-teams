import {InstagramAuthError, InstagramAccountDiscoveryError} from './errors.js'
import {
  GRAPH_API_BASE,
  instagramBusinessAccountResponseSchema,
} from './instagram-types.js'
import type {InstagramAccountInfo} from './instagram-types.js'

// Reuse Facebook token exchange schemas (same Graph API)
import {
  facebookTokenResponseSchema,
  facebookMeAccountsSchema,
} from '../facebook/facebook-types.js'
import type {FacebookPage} from '../facebook/facebook-types.js'

const INSTAGRAM_OAUTH_BASE = 'https://www.facebook.com/v24.0/dialog/oauth'

// Instagram requires these scopes on top of the regular Facebook Page scopes
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
]

/**
 * Build the Instagram OAuth authorization URL.
 * Uses the Facebook Login flow since Instagram Graph API requires a Facebook Page.
 */
export function buildInstagramAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string[] = INSTAGRAM_SCOPES,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(','),
    response_type: 'code',
  })
  return `${INSTAGRAM_OAUTH_BASE}?${params.toString()}`
}

/**
 * Exchange an authorization code for a short-lived user access token (1 hour).
 * Step 1 of the Meta token chain.
 */
export async function exchangeInstagramCode(
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
    throw new InstagramAuthError(`Code exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new InstagramAuthError('Invalid token response from Meta')
  }

  return parsed.data.access_token
}

/**
 * Exchange a short-lived user token for a long-lived user token (60 days).
 * Step 2 of the Meta token chain.
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
    throw new InstagramAuthError(`Long-lived token exchange failed (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookTokenResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new InstagramAuthError('Invalid token response from Meta')
  }

  return {
    accessToken: parsed.data.access_token,
    expiresIn: parsed.data.expires_in ?? 5_184_000, // default 60 days
  }
}

/**
 * Get Page Access Tokens from a long-lived user token.
 * Step 3 of the Meta token chain.
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
    throw new InstagramAuthError(`Failed to retrieve Page tokens (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = facebookMeAccountsSchema.safeParse(data)
  if (!parsed.success) {
    throw new InstagramAuthError('Invalid /me/accounts response from Meta')
  }

  return parsed.data.data
}

/**
 * Discover the linked Instagram Business/Creator account for a Facebook Page.
 *
 * Uses: GET /{page-id}?fields=instagram_business_account
 *
 * Returns the Instagram User ID if a linked Business/Creator account exists, null otherwise.
 */
export async function discoverInstagramAccount(
  pageId: string,
  pageAccessToken: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<string | null> {
  const params = new URLSearchParams({
    fields: 'instagram_business_account',
    access_token: pageAccessToken,
  })

  const response = await fetchFn(`${GRAPH_API_BASE}/${encodeURIComponent(pageId)}?${params.toString()}`)

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new InstagramAccountDiscoveryError(`Failed to query Page ${pageId} (HTTP ${response.status}): ${text}`)
  }

  const data = await response.json()
  const parsed = instagramBusinessAccountResponseSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }

  return parsed.data.instagram_business_account?.id ?? null
}

/**
 * Discover all Pages with linked Instagram accounts.
 *
 * Iterates through the user's Pages, querying each for a linked Instagram Business/Creator account.
 * Returns an array of InstagramAccountInfo for Pages with linked accounts.
 */
export async function discoverAllInstagramAccounts(
  pages: FacebookPage[],
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<InstagramAccountInfo[]> {
  const accounts: InstagramAccountInfo[] = []

  for (const page of pages) {
    const igUserId = await discoverInstagramAccount(page.id, page.access_token, fetchFn)
    if (igUserId) {
      accounts.push({
        igUserId,
        pageId: page.id,
        pageAccessToken: page.access_token,
        pageName: page.name,
      })
    }
  }

  return accounts
}

/**
 * Get the Instagram OAuth scopes used by this adapter.
 */
export function getInstagramScopes(): string[] {
  return [...INSTAGRAM_SCOPES]
}
