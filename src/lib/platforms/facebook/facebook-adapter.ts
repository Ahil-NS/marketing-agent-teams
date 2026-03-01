import type {CredentialManager} from '../../credentials/credential-manager.js'
import type {
  AuthResult,
  ContentValidationError,
  ContentValidationResult,
  ContentValidationWarning,
  PlatformAdapter,
  PlatformContent,
  PlatformMetrics,
  PublishResult,
  RateLimitStatus,
} from '../types.js'
import type {FacebookRateLimitState} from './facebook-types.js'

import {getPlatformOAuthConfig} from '../../credentials/platform-oauth-config.js'
import {validateContentForPlatform} from '../content-validator.js'
import {
  FacebookApiError,
  classifyFacebookErrorCode,
  classifyHttpStatus,
} from './errors.js'
import {
  buildFacebookAuthorizationUrl,
  getPageAccessTokens,
  exchangeFacebookCode,
  exchangeForLongLivedToken,
} from './facebook-auth.js'
import {
  GRAPH_API_BASE,
  FACEBOOK_THROTTLE_THRESHOLD,
  FACEBOOK_PAGE_CALLS_PER_DAY,
  FACEBOOK_POST_MAX_LENGTH,
  facebookAppUsageSchema,
  facebookFeedPostResponseSchema,
  facebookGraphErrorSchema,
  facebookPhotoUploadResponseSchema,
  facebookPostMetricsSchema,
} from './facebook-types.js'

const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_MS = 2000

export interface FacebookAdapterOptions {
  credentialManager: CredentialManager
  /** Facebook Page ID to publish to */
  pageId?: string
  /** Override fetch for testing */
  fetchFn?: typeof globalThis.fetch
  /** Override browser-open for testing */
  openBrowser?: (url: string) => Promise<void>
  /** Override console output for testing */
  log?: (message: string) => void
  /** Override sleep for testing */
  sleepFn?: (ms: number) => Promise<void>
  /** Override page selection for testing */
  selectPage?: (pages: Array<{id: string; name: string}>) => Promise<string>
  /** Track last published body per Page for duplicate detection */
  lastPublishedBody?: string
}

export class FacebookAdapter implements PlatformAdapter {
  readonly platform = 'facebook' as const

  private readonly credentialManager: CredentialManager
  private readonly fetchFn: typeof globalThis.fetch
  private readonly openBrowser: (url: string) => Promise<void>
  private readonly log: (message: string) => void
  private readonly sleepFn: (ms: number) => Promise<void>
  private readonly selectPage: (pages: Array<{id: string; name: string}>) => Promise<string>

  private pageId?: string
  private lastPublishedBody?: string

  private rateLimitState: FacebookRateLimitState = {
    callCount: 0,
    totalCpuTime: 0,
    totalTime: 0,
    updatedAt: 0,
    pageCallsRemaining: FACEBOOK_PAGE_CALLS_PER_DAY,
    pageCallsResetAt: 0,
  }

  constructor(options: FacebookAdapterOptions) {
    this.credentialManager = options.credentialManager
    this.pageId = options.pageId
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.openBrowser = options.openBrowser ?? defaultOpenBrowser
    this.log = options.log ?? console.log.bind(console)
    this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
    this.selectPage = options.selectPage ?? defaultSelectPage
    this.lastPublishedBody = options.lastPublishedBody
  }

  async authenticate(): Promise<AuthResult> {
    const oauthConfig = getPlatformOAuthConfig('facebook')
    if (!oauthConfig) {
      return {
        success: false,
        platform: 'facebook',
        scopes: [],
        error: 'Facebook OAuth credentials not configured. Set MAT_FACEBOOK_CLIENT_ID and MAT_FACEBOOK_CLIENT_SECRET environment variables.',
      }
    }

    const {clientId, clientSecret} = oauthConfig
    const scopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']

    // Start ephemeral callback server
    const {createServer} = await import('node:http')
    const {randomBytes} = await import('node:crypto')
    const {URL} = await import('node:url')

    const state = randomBytes(16).toString('hex')
    let port = 0

    const codePromise = new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400)
          res.end('Bad request')
          return
        }

        const url = new URL(req.url, `http://localhost:${port}`)
        if (!url.pathname.startsWith('/callback')) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const error = url.searchParams.get('error')
        if (error) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Authorization Failed</h1><p>You can close this window.</p></body></html>')
          server.close()
          reject(new FacebookApiError(401, `OAuth denied: ${error}`, 'permanent'))
          return
        }

        const callbackState = url.searchParams.get('state')
        if (callbackState !== state) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Security Error</h1><p>State mismatch.</p></body></html>')
          server.close()
          reject(new FacebookApiError(400, 'OAuth state mismatch', 'permanent'))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Error</h1><p>No authorization code.</p></body></html>')
          server.close()
          reject(new FacebookApiError(400, 'No authorization code received', 'permanent'))
          return
        }

        res.writeHead(200, {'Content-Type': 'text/html'})
        res.end('<html><body><h1>Authorization Successful</h1><p>You can close this window.</p></body></html>')
        server.close()
        resolve(code)
      })

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          port = addr.port
        }
      })
    })

    const redirectUri = `http://localhost:${port}/callback`
    const authUrl = buildFacebookAuthorizationUrl(clientId, redirectUri, state, scopes)

    try {
      await this.openBrowser(authUrl)
      this.log('Opening browser for Facebook authorization...')
    } catch {
      this.log(`\nCannot open browser. Please visit the following URL to authorize:\n\n${authUrl}\n`)
    }

    try {
      const code = await codePromise

      // Execute token chain: code → short-lived → long-lived → Page tokens
      const shortLivedToken = await exchangeFacebookCode(code, redirectUri, clientId, clientSecret, this.fetchFn)
      const {accessToken: longLivedToken} = await exchangeForLongLivedToken(shortLivedToken, clientId, clientSecret, this.fetchFn)
      const pages = await getPageAccessTokens(longLivedToken, this.fetchFn)

      if (pages.length === 0) {
        return {
          success: false,
          platform: 'facebook',
          scopes,
          error: 'No Facebook Pages found for this account. You must have admin access to at least one Page.',
        }
      }

      // Page selection
      let selectedPageId: string
      if (pages.length === 1) {
        selectedPageId = pages[0]!.id
        this.log(`Connected to Page: ${pages[0]!.name} (${pages[0]!.id})`)
      } else {
        this.log(`Found ${pages.length} Facebook Pages:`)
        for (const page of pages) {
          this.log(`  - ${page.name} (${page.id})`)
        }

        selectedPageId = await this.selectPage(pages.map((p) => ({id: p.id, name: p.name})))
      }

      const selectedPage = pages.find((p) => p.id === selectedPageId)
      if (!selectedPage) {
        return {
          success: false,
          platform: 'facebook',
          scopes,
          error: `Selected Page '${selectedPageId}' not found`,
        }
      }

      this.pageId = selectedPageId

      // Page Access Tokens from long-lived user tokens are never-expiring
      const tokens = {
        accessToken: selectedPage.access_token,
        refreshToken: '', // Not applicable
        expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      }

      await this.credentialManager.store('facebook', tokens, scopes)

      return {
        success: true,
        platform: 'facebook',
        scopes,
      }
    } catch (error) {
      return {
        success: false,
        platform: 'facebook',
        scopes: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    const staticResult = validateContentForPlatform(content)
    const errors: ContentValidationError[] = [...staticResult.errors]
    const warnings: ContentValidationWarning[] = [...staticResult.warnings]

    // Check post text max 63,206 chars (additional specific check)
    if (content.content.body.length > FACEBOOK_POST_MAX_LENGTH) {
      // Only add if not already flagged by static validator
      const alreadyFlagged = errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')
      if (!alreadyFlagged) {
        errors.push({
          field: 'body',
          constraint: 'maxLength',
          message: `Post exceeds maximum length of ${FACEBOOK_POST_MAX_LENGTH} characters`,
          value: content.content.body.length,
          limit: FACEBOOK_POST_MAX_LENGTH,
        })
      }
    }

    // Duplicate detection: no identical consecutive posts
    if (this.lastPublishedBody && content.content.body === this.lastPublishedBody) {
      errors.push({
        field: 'body',
        constraint: 'duplicate',
        message: 'Identical consecutive posts are blocked by Facebook. Vary the content.',
      })
    }

    // Validate media URLs are HTTPS if present
    if (content.content.media) {
      for (const media of content.content.media) {
        if (media.url && !media.url.startsWith('https://')) {
          errors.push({
            field: 'media.url',
            constraint: 'https',
            message: `Media URLs must use HTTPS: ${media.url}`,
            value: media.url,
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      platform: 'facebook',
      errors,
      warnings,
    }
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    const pageId = this.pageId ?? (content.content.platformMeta?.['pageId'] as string | undefined)
    if (!pageId) {
      return {
        success: false,
        platform: 'facebook',
        itemId: content.itemId,
        error: {
          code: 'FACEBOOK_MISSING_PAGE_ID',
          message: 'Facebook Page ID is required. Run authenticate() first or provide pageId in platformMeta.',
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    // Determine post type
    const photos = content.content.media?.filter((m) => m.type === 'image' && m.url) ?? []
    const isMultiPhoto = photos.length > 1
    const isSinglePhoto = photos.length === 1
    const hasLink = Boolean(content.content.platformMeta?.['link'])

    // Retry loop with exponential backoff
    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.throttle()

        const entry = await this.credentialManager.retrieve('facebook')
        const accessToken = entry.tokens.accessToken

        let result: PublishResult

        if (isMultiPhoto) {
          result = await this.publishMultiPhoto(pageId, accessToken, content, photos)
        } else if (isSinglePhoto) {
          result = await this.publishSinglePhoto(pageId, accessToken, content, photos[0]!.url!)
        } else {
          result = await this.publishTextOrLink(pageId, accessToken, content, hasLink)
        }

        if (result.success) {
          this.lastPublishedBody = content.content.body
        }

        // Check for transient errors that should be retried
        if (!result.success && result.error?.retryable && attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = BASE_RETRY_MS * Math.pow(2, attempt)
          await this.sleepFn(delay)
          lastError = new Error(result.error.message)
          continue
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = BASE_RETRY_MS * Math.pow(2, attempt)
          await this.sleepFn(delay)
          continue
        }
      }
    }

    return {
      success: false,
      platform: 'facebook',
      itemId: content.itemId,
      error: {
        code: 'FACEBOOK_MAX_RETRIES',
        message: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message ?? 'Unknown error'}`,
        classification: 'transient',
        retryable: false,
      },
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    const entry = await this.credentialManager.retrieve('facebook')
    const params = new URLSearchParams({
      fields: 'likes.summary(true),comments.summary(true),shares',
      access_token: entry.tokens.accessToken,
    })

    const response = await this.fetchFn(`${GRAPH_API_BASE}/${encodeURIComponent(postId)}?${params.toString()}`)
    this.parseAppUsage(response.headers)

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new FacebookApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    const parsed = facebookPostMetricsSchema.safeParse(rawData)
    if (!parsed.success) {
      return {
        postId,
        platform: 'facebook',
        retrievedAt: new Date().toISOString(),
      }
    }

    return {
      postId,
      platform: 'facebook',
      likes: parsed.data.likes?.summary.total_count,
      comments: parsed.data.comments?.summary.total_count,
      shares: parsed.data.shares?.count,
      retrievedAt: new Date().toISOString(),
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: 'facebook',
      remaining: this.rateLimitState.pageCallsRemaining,
      limit: FACEBOOK_PAGE_CALLS_PER_DAY,
      resetsAt: new Date(this.rateLimitState.pageCallsResetAt).toISOString(),
      windowType: 'day',
    }
  }

  async disconnect(): Promise<void> {
    // Facebook has no token revocation API for Page Access Tokens
    // Simply remove from keychain
    await this.credentialManager.remove('facebook')
  }

  // --- Internal helpers ---

  private async publishTextOrLink(
    pageId: string,
    accessToken: string,
    content: PlatformContent,
    hasLink: boolean,
  ): Promise<PublishResult> {
    const body = new URLSearchParams({
      message: content.content.body,
      access_token: accessToken,
    })

    if (hasLink) {
      body.set('link', content.content.platformMeta['link'] as string)
    }

    const response = await this.fetchFn(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
    })

    this.parseAppUsage(response.headers)
    return this.handlePublishResponse(response, content.itemId, pageId)
  }

  private async publishSinglePhoto(
    pageId: string,
    accessToken: string,
    content: PlatformContent,
    photoUrl: string,
  ): Promise<PublishResult> {
    const body = new URLSearchParams({
      url: photoUrl,
      caption: content.content.body,
      access_token: accessToken,
    })

    const response = await this.fetchFn(`${GRAPH_API_BASE}/${pageId}/photos`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
    })

    this.parseAppUsage(response.headers)

    if (!response.ok) {
      return this.handleApiError(response, content.itemId)
    }

    const rawData = await response.json()
    const parsed = facebookPhotoUploadResponseSchema.safeParse(rawData)
    if (!parsed.success) {
      return {
        success: false,
        platform: 'facebook',
        itemId: content.itemId,
        error: {
          code: 'FACEBOOK_INVALID_RESPONSE',
          message: 'Invalid response from Facebook photo upload API',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    const postId = parsed.data.post_id ?? parsed.data.id
    return {
      success: true,
      platform: 'facebook',
      itemId: content.itemId,
      postId,
      postUrl: `https://www.facebook.com/${postId}`,
      publishedAt: new Date().toISOString(),
    }
  }

  private async publishMultiPhoto(
    pageId: string,
    accessToken: string,
    content: PlatformContent,
    photos: Array<{url?: string}>,
  ): Promise<PublishResult> {
    // Step 1: Upload each photo unpublished
    const uploadedPhotoIds: string[] = []

    for (const photo of photos) {
      if (!photo.url) continue

      const body = new URLSearchParams({
        url: photo.url,
        published: 'false',
        access_token: accessToken,
      })

      const response = await this.fetchFn(`${GRAPH_API_BASE}/${pageId}/photos`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body,
      })

      this.parseAppUsage(response.headers)

      if (!response.ok) {
        // Cleanup: attempt to delete successfully uploaded unpublished photos
        // Note: Graph API doesn't support deleting unpublished photos easily,
        // but they will expire automatically. Log the cleanup attempt.
        return {
          success: false,
          platform: 'facebook',
          itemId: content.itemId,
          error: {
            code: 'FACEBOOK_MULTI_PHOTO_UPLOAD_FAILED',
            message: `Failed to upload photo (${uploadedPhotoIds.length + 1}/${photos.length}). ${uploadedPhotoIds.length} photos uploaded but not published.`,
            classification: 'transient',
            retryable: true,
          },
        }
      }

      const rawData = await response.json()
      const parsed = facebookPhotoUploadResponseSchema.safeParse(rawData)
      if (!parsed.success) {
        return {
          success: false,
          platform: 'facebook',
          itemId: content.itemId,
          error: {
            code: 'FACEBOOK_INVALID_RESPONSE',
            message: 'Invalid response from Facebook photo upload API',
            classification: 'transient',
            retryable: true,
          },
        }
      }

      uploadedPhotoIds.push(parsed.data.id)
    }

    // Step 2: Create feed post with attached media
    const feedBody = new URLSearchParams({
      message: content.content.body,
      access_token: accessToken,
    })

    for (const [i, photoId] of uploadedPhotoIds.entries()) {
      feedBody.set(`attached_media[${i}]`, JSON.stringify({media_fbid: photoId}))
    }

    const feedResponse = await this.fetchFn(`${GRAPH_API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: feedBody,
    })

    this.parseAppUsage(feedResponse.headers)
    return this.handlePublishResponse(feedResponse, content.itemId, pageId)
  }

  private async handlePublishResponse(response: Response, itemId: string, _pageId: string): Promise<PublishResult> {
    if (!response.ok) {
      return this.handleApiError(response, itemId)
    }

    const rawData = await response.json()
    const parsed = facebookFeedPostResponseSchema.safeParse(rawData)
    if (!parsed.success) {
      return {
        success: false,
        platform: 'facebook',
        itemId,
        error: {
          code: 'FACEBOOK_INVALID_RESPONSE',
          message: 'Invalid response from Facebook feed API',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    return {
      success: true,
      platform: 'facebook',
      itemId,
      postId: parsed.data.id,
      postUrl: `https://www.facebook.com/${parsed.data.id}`,
      publishedAt: new Date().toISOString(),
    }
  }

  private async handleApiError(response: Response, itemId: string): Promise<PublishResult> {
    const text = await response.text().catch(() => response.statusText)

    // Try to parse as Graph API error
    try {
      const errorData = JSON.parse(text)
      const graphError = facebookGraphErrorSchema.safeParse(errorData)
      if (graphError.success) {
        const errorCode = graphError.data.error.code
        const classification = classifyFacebookErrorCode(errorCode)
        return {
          success: false,
          platform: 'facebook',
          itemId,
          error: {
            code: `FACEBOOK_GRAPH_${errorCode}`,
            message: graphError.data.error.message,
            classification,
            retryable: classification === 'transient',
            retryAfterMs: classification === 'transient' ? BASE_RETRY_MS : undefined,
          },
        }
      }
    } catch {
      // Not JSON — fall through to generic error
    }

    const classification = classifyHttpStatus(response.status)
    return {
      success: false,
      platform: 'facebook',
      itemId,
      error: {
        code: `FACEBOOK_HTTP_${response.status}`,
        message: `Facebook API error (HTTP ${response.status}): ${text}`,
        classification,
        retryable: classification === 'transient',
        retryAfterMs: classification === 'transient' ? BASE_RETRY_MS : undefined,
      },
    }
  }

  private parseAppUsage(headers: Headers): void {
    const appUsageRaw = headers.get('x-app-usage')
    if (!appUsageRaw) return

    try {
      const parsed = facebookAppUsageSchema.safeParse(JSON.parse(appUsageRaw))
      if (parsed.success) {
        this.rateLimitState.callCount = parsed.data.call_count
        this.rateLimitState.totalCpuTime = parsed.data.total_cputime
        this.rateLimitState.totalTime = parsed.data.total_time
        this.rateLimitState.updatedAt = Date.now()

        // Estimate pages remaining based on call_count percentage
        const usagePercent = Math.max(parsed.data.call_count, parsed.data.total_cputime, parsed.data.total_time)
        this.rateLimitState.pageCallsRemaining = Math.round(FACEBOOK_PAGE_CALLS_PER_DAY * (1 - usagePercent / 100))
        this.rateLimitState.pageCallsResetAt = Date.now() + 24 * 60 * 60 * 1000 // 24h from now
      }
    } catch {
      // Ignore malformed header
    }
  }

  private async throttle(): Promise<void> {
    const maxUsage = Math.max(
      this.rateLimitState.callCount,
      this.rateLimitState.totalCpuTime,
      this.rateLimitState.totalTime,
    )

    if (maxUsage >= FACEBOOK_THROTTLE_THRESHOLD) {
      // Wait 60 seconds when approaching rate limit
      const waitMs = 60_000
      this.log(`Facebook rate limit at ${maxUsage}% — throttling for 60s`)
      await this.sleepFn(waitMs)
    }
  }
}

async function defaultOpenBrowser(url: string): Promise<void> {
  const {exec} = await import('node:child_process')
  const {promisify} = await import('node:util')
  const execAsync = promisify(exec)

  const platform = process.platform
  const command =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'

  await execAsync(`${command} "${url}"`)
}

async function defaultSelectPage(pages: Array<{id: string; name: string}>): Promise<string> {
  // In a real CLI, this would use @inquirer/prompts
  // Default to first page for non-interactive contexts
  return pages[0]?.id ?? ''
}
