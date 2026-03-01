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
import type {InstagramRateLimitState, ContainerStatus} from './instagram-types.js'

import {getPlatformOAuthConfig} from '../../credentials/platform-oauth-config.js'
import {validateContentForPlatform} from '../content-validator.js'
import {
  InstagramApiError,
  classifyInstagramErrorCode,
  classifyHttpStatus,
} from './errors.js'
import {
  buildInstagramAuthorizationUrl,
  exchangeInstagramCode,
  exchangeForLongLivedToken,
  getPageAccessTokens,
  discoverAllInstagramAccounts,
  getInstagramScopes,
} from './instagram-auth.js'
import {
  GRAPH_API_BASE,
  INSTAGRAM_CAPTION_MAX_LENGTH,
  INSTAGRAM_HASHTAG_MAX_COUNT,
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  INSTAGRAM_CAROUSEL_VIDEO_MAX_SECONDS,
  INSTAGRAM_ASPECT_RATIO_MIN,
  INSTAGRAM_ASPECT_RATIO_MAX,
  INSTAGRAM_API_CALLS_PER_HOUR,
  INSTAGRAM_POSTS_PER_DAY,
  INSTAGRAM_CONTAINER_POLL_INTERVAL_MS,
  INSTAGRAM_CONTAINER_POLL_TIMEOUT_MS,
  instagramContainerResponseSchema,
  instagramContainerStatusResponseSchema,
  instagramMediaPublishResponseSchema,
  instagramPublishingLimitSchema,
  instagramGraphErrorSchema,
  instagramMediaMetricsSchema,
} from './instagram-types.js'

const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_MS = 2000

export interface InstagramAdapterOptions {
  credentialManager: CredentialManager
  /** Instagram User ID (numeric) */
  igUserId?: string
  /** Override fetch for testing */
  fetchFn?: typeof globalThis.fetch
  /** Override browser-open for testing */
  openBrowser?: (url: string) => Promise<void>
  /** Override console output for testing */
  log?: (message: string) => void
  /** Override sleep for testing */
  sleepFn?: (ms: number) => Promise<void>
  /** Override account selection for testing */
  selectAccount?: (accounts: Array<{igUserId: string; pageName: string}>) => Promise<string>
  /** Container poll interval override for testing */
  pollIntervalMs?: number
  /** Container poll timeout override for testing */
  pollTimeoutMs?: number
}

export class InstagramAdapter implements PlatformAdapter {
  readonly platform = 'instagram' as const

  private readonly credentialManager: CredentialManager
  private readonly fetchFn: typeof globalThis.fetch
  private readonly openBrowser: (url: string) => Promise<void>
  private readonly log: (message: string) => void
  private readonly sleepFn: (ms: number) => Promise<void>
  private readonly selectAccount: (accounts: Array<{igUserId: string; pageName: string}>) => Promise<string>
  private readonly pollIntervalMs: number
  private readonly pollTimeoutMs: number

  private igUserId?: string

  private rateLimitState: InstagramRateLimitState = {
    apiCallCount: 0,
    apiCallsResetAt: 0,
    publishCount: 0,
    publishResetAt: 0,
    updatedAt: 0,
  }

  constructor(options: InstagramAdapterOptions) {
    this.credentialManager = options.credentialManager
    this.igUserId = options.igUserId
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.openBrowser = options.openBrowser ?? defaultOpenBrowser
    this.log = options.log ?? console.log.bind(console)
    this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
    this.selectAccount = options.selectAccount ?? defaultSelectAccount
    this.pollIntervalMs = options.pollIntervalMs ?? INSTAGRAM_CONTAINER_POLL_INTERVAL_MS
    this.pollTimeoutMs = options.pollTimeoutMs ?? INSTAGRAM_CONTAINER_POLL_TIMEOUT_MS
  }

  async authenticate(): Promise<AuthResult> {
    const oauthConfig = getPlatformOAuthConfig('instagram')
    if (!oauthConfig) {
      return {
        success: false,
        platform: 'instagram',
        scopes: [],
        error: 'Instagram OAuth credentials not configured. Set MAT_INSTAGRAM_CLIENT_ID and MAT_INSTAGRAM_CLIENT_SECRET environment variables.',
      }
    }

    const {clientId, clientSecret} = oauthConfig
    const scopes = getInstagramScopes()

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
          reject(new InstagramApiError(401, `OAuth denied: ${error}`, 'permanent'))
          return
        }

        const callbackState = url.searchParams.get('state')
        if (callbackState !== state) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Security Error</h1><p>State mismatch.</p></body></html>')
          server.close()
          reject(new InstagramApiError(400, 'OAuth state mismatch', 'permanent'))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Error</h1><p>No authorization code.</p></body></html>')
          server.close()
          reject(new InstagramApiError(400, 'No authorization code received', 'permanent'))
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
    const authUrl = buildInstagramAuthorizationUrl(clientId, redirectUri, state, scopes)

    try {
      await this.openBrowser(authUrl)
      this.log('Opening browser for Instagram authorization (via Facebook Login)...')
    } catch {
      this.log(`\nCannot open browser. Please visit the following URL to authorize:\n\n${authUrl}\n`)
    }

    try {
      const code = await codePromise

      // Execute token chain: code → short-lived → long-lived → Page tokens → IG account discovery
      const shortLivedToken = await exchangeInstagramCode(code, redirectUri, clientId, clientSecret, this.fetchFn)
      const {accessToken: longLivedToken} = await exchangeForLongLivedToken(shortLivedToken, clientId, clientSecret, this.fetchFn)
      const pages = await getPageAccessTokens(longLivedToken, this.fetchFn)

      if (pages.length === 0) {
        return {
          success: false,
          platform: 'instagram',
          scopes,
          error: 'No Facebook Pages found. Instagram Graph API requires a Facebook Page linked to an Instagram Business/Creator account.',
        }
      }

      // Discover Instagram accounts linked to Pages
      const igAccounts = await discoverAllInstagramAccounts(pages, this.fetchFn)

      if (igAccounts.length === 0) {
        return {
          success: false,
          platform: 'instagram',
          scopes,
          error: 'No Instagram Business/Creator accounts found linked to your Facebook Pages. Ensure your Page is linked to an Instagram Business or Creator account.',
        }
      }

      // Account selection
      let selectedAccount: typeof igAccounts[0]
      if (igAccounts.length === 1) {
        selectedAccount = igAccounts[0]!
        this.log(`Connected to Instagram account via Page: ${selectedAccount.pageName} (IG User ID: ${selectedAccount.igUserId})`)
      } else {
        this.log(`Found ${igAccounts.length} Instagram accounts:`)
        for (const account of igAccounts) {
          this.log(`  - ${account.pageName} → IG User ID: ${account.igUserId}`)
        }

        const selectedIgUserId = await this.selectAccount(
          igAccounts.map((a) => ({igUserId: a.igUserId, pageName: a.pageName})),
        )
        selectedAccount = igAccounts.find((a) => a.igUserId === selectedIgUserId) ?? igAccounts[0]!
      }

      this.igUserId = selectedAccount.igUserId

      // Store never-expiring Page Access Token
      const tokens = {
        accessToken: selectedAccount.pageAccessToken,
        refreshToken: '', // Not applicable
        expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      }

      await this.credentialManager.store('instagram', tokens, scopes)

      return {
        success: true,
        platform: 'instagram',
        scopes,
      }
    } catch (error) {
      return {
        success: false,
        platform: 'instagram',
        scopes: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    const staticResult = validateContentForPlatform(content)
    const errors: ContentValidationError[] = [...staticResult.errors]
    const warnings: ContentValidationWarning[] = [...staticResult.warnings]

    // Caption max 2,200 chars (additional specific check)
    if (content.content.body.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
      const alreadyFlagged = errors.some((e) => e.field === 'body' && e.constraint === 'maxLength')
      if (!alreadyFlagged) {
        errors.push({
          field: 'body',
          constraint: 'maxLength',
          message: `Caption exceeds maximum length of ${INSTAGRAM_CAPTION_MAX_LENGTH} characters`,
          value: content.content.body.length,
          limit: INSTAGRAM_CAPTION_MAX_LENGTH,
        })
      }
    }

    // Hashtags max 30
    if (content.content.hashtags && content.content.hashtags.length > INSTAGRAM_HASHTAG_MAX_COUNT) {
      const alreadyFlagged = errors.some((e) => e.field === 'hashtags' && e.constraint === 'maxCount')
      if (!alreadyFlagged) {
        errors.push({
          field: 'hashtags',
          constraint: 'maxCount',
          message: `Hashtag count exceeds maximum of ${INSTAGRAM_HASHTAG_MAX_COUNT}`,
          value: content.content.hashtags.length,
          limit: INSTAGRAM_HASHTAG_MAX_COUNT,
        })
      }
    }

    // Validate media URLs are HTTPS
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

      // Validate aspect ratio via platformMeta
      const aspectRatio = content.content.platformMeta?.['aspectRatio'] as number | undefined
      if (aspectRatio !== undefined) {
        if (aspectRatio < INSTAGRAM_ASPECT_RATIO_MIN || aspectRatio > INSTAGRAM_ASPECT_RATIO_MAX) {
          errors.push({
            field: 'media.aspectRatio',
            constraint: 'range',
            message: `Image aspect ratio must be between ${INSTAGRAM_ASPECT_RATIO_MIN} (4:5) and ${INSTAGRAM_ASPECT_RATIO_MAX} (1.91:1). Got ${aspectRatio}`,
            value: aspectRatio,
          })
        }
      }

      // Validate video format via platformMeta
      const videoFormat = content.content.platformMeta?.['videoFormat'] as string | undefined
      if (videoFormat) {
        const allowedFormats = ['mp4', 'mov']
        if (!allowedFormats.includes(videoFormat.toLowerCase())) {
          errors.push({
            field: 'media.videoFormat',
            constraint: 'format',
            message: `Video format must be MP4 or MOV. Got: ${videoFormat}`,
            value: videoFormat,
          })
        }
      }

      // Validate video duration via platformMeta
      const videoDuration = content.content.platformMeta?.['videoDuration'] as number | undefined
      if (videoDuration !== undefined) {
        const isCarousel = content.content.media.some((m) => m.type === 'carousel')
        const maxDuration = isCarousel ? INSTAGRAM_CAROUSEL_VIDEO_MAX_SECONDS : 900
        if (videoDuration < 3 || videoDuration > maxDuration) {
          errors.push({
            field: 'media.videoDuration',
            constraint: 'range',
            message: `Video duration must be between 3 and ${maxDuration} seconds. Got: ${videoDuration}s`,
            value: videoDuration,
            limit: maxDuration,
          })
        }
      }

      // Carousel-specific validation
      if (content.content.media.length > 1 || content.content.media.some((m) => m.type === 'carousel')) {
        if (content.content.media.length > INSTAGRAM_CAROUSEL_MAX_ITEMS) {
          errors.push({
            field: 'media',
            constraint: 'carouselMaxItems',
            message: `Carousel cannot exceed ${INSTAGRAM_CAROUSEL_MAX_ITEMS} items. Got: ${content.content.media.length}`,
            value: content.content.media.length,
            limit: INSTAGRAM_CAROUSEL_MAX_ITEMS,
          })
        }
      }
    }

    // Check publishing quota if we have credentials
    try {
      const igUserId = this.igUserId ?? (content.content.platformMeta?.['igUserId'] as string | undefined)
      if (igUserId) {
        const quotaResult = await this.checkPublishingQuota(igUserId)
        if (quotaResult) {
          const {quotaUsage, quotaTotal} = quotaResult
          if (quotaUsage >= quotaTotal) {
            errors.push({
              field: 'publishingLimit',
              constraint: 'quota',
              message: `Publishing quota exhausted: ${quotaUsage}/${quotaTotal} posts in 24h window`,
              value: quotaUsage,
              limit: quotaTotal,
            })
          } else if (quotaUsage >= quotaTotal - 5) {
            warnings.push({
              field: 'publishingLimit',
              message: `Approaching publishing limit: ${quotaUsage}/${quotaTotal} posts used`,
            })
          }
        }
      }
    } catch {
      // Quota check is best-effort; don't fail validation if it errors
      warnings.push({
        field: 'publishingLimit',
        message: 'Could not check publishing quota — will attempt to publish anyway',
      })
    }

    return {
      valid: errors.length === 0,
      platform: 'instagram',
      errors,
      warnings,
    }
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    const igUserId = this.igUserId ?? (content.content.platformMeta?.['igUserId'] as string | undefined)
    if (!igUserId) {
      return {
        success: false,
        platform: 'instagram',
        itemId: content.itemId,
        error: {
          code: 'INSTAGRAM_MISSING_USER_ID',
          message: 'Instagram User ID is required. Run authenticate() first or provide igUserId in platformMeta.',
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    // Determine content type
    const media = content.content.media ?? []
    const isCarousel = media.length > 1
    const isReels = media.length === 1 && media[0]?.type === 'video'
    const isSingleImage = media.length === 1 && media[0]?.type === 'image'

    // Retry loop with exponential backoff
    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.throttle()

        const entry = await this.credentialManager.retrieve('instagram')
        const accessToken = entry.tokens.accessToken
        const caption = this.buildCaption(content)

        let result: PublishResult

        if (isCarousel) {
          result = await this.publishCarousel(igUserId, accessToken, content, caption)
        } else if (isReels) {
          result = await this.publishReels(igUserId, accessToken, content, caption, media[0]!.url!)
        } else if (isSingleImage) {
          result = await this.publishSingleImage(igUserId, accessToken, content, caption, media[0]!.url!)
        } else {
          return {
            success: false,
            platform: 'instagram',
            itemId: content.itemId,
            error: {
              code: 'INSTAGRAM_MISSING_MEDIA',
              message: 'Instagram requires at least one media attachment (image or video).',
              classification: 'permanent',
              retryable: false,
            },
          }
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
      platform: 'instagram',
      itemId: content.itemId,
      error: {
        code: 'INSTAGRAM_MAX_RETRIES',
        message: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message ?? 'Unknown error'}`,
        classification: 'transient',
        retryable: false,
      },
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    const entry = await this.credentialManager.retrieve('instagram')
    const params = new URLSearchParams({
      fields: 'like_count,comments_count,impressions,reach,saved,shares',
      access_token: entry.tokens.accessToken,
    })

    const response = await this.fetchFn(
      `${GRAPH_API_BASE}/${encodeURIComponent(postId)}?${params.toString()}`,
    )

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new InstagramApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    const parsed = instagramMediaMetricsSchema.safeParse(rawData)
    if (!parsed.success) {
      return {
        postId,
        platform: 'instagram',
        retrievedAt: new Date().toISOString(),
      }
    }

    return {
      postId,
      platform: 'instagram',
      likes: parsed.data.like_count,
      comments: parsed.data.comments_count,
      views: parsed.data.impressions,
      shares: parsed.data.shares,
      retrievedAt: new Date().toISOString(),
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: 'instagram',
      remaining: INSTAGRAM_API_CALLS_PER_HOUR - this.rateLimitState.apiCallCount,
      limit: INSTAGRAM_API_CALLS_PER_HOUR,
      resetsAt: new Date(this.rateLimitState.apiCallsResetAt).toISOString(),
      windowType: 'hour',
    }
  }

  async disconnect(): Promise<void> {
    await this.credentialManager.remove('instagram')
  }

  // --- Internal helpers ---

  private buildCaption(content: PlatformContent): string {
    let caption = content.content.body
    if (content.content.hashtags && content.content.hashtags.length > 0) {
      const hashtagStr = content.content.hashtags
        .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
        .join(' ')
      caption = `${caption}\n\n${hashtagStr}`
    }
    return caption
  }

  private async publishSingleImage(
    igUserId: string,
    accessToken: string,
    content: PlatformContent,
    caption: string,
    imageUrl: string,
  ): Promise<PublishResult> {
    // Step 1: Create container
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    })

    const containerResponse = await this.fetchFn(`${GRAPH_API_BASE}/${igUserId}/media`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: containerParams,
    })

    this.trackApiCall()

    if (!containerResponse.ok) {
      return this.handleApiError(containerResponse, content.itemId)
    }

    const containerData = await containerResponse.json()
    const containerParsed = instagramContainerResponseSchema.safeParse(containerData)
    if (!containerParsed.success) {
      return {
        success: false,
        platform: 'instagram',
        itemId: content.itemId,
        error: {
          code: 'INSTAGRAM_INVALID_RESPONSE',
          message: 'Invalid container creation response from Instagram',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    // Step 1.5: Poll status
    const pollResult = await this.pollContainerStatus(containerParsed.data.id, accessToken)
    if (pollResult !== 'FINISHED') {
      return this.handleContainerFailure(containerParsed.data.id, pollResult, content.itemId)
    }

    // Step 2: Publish
    return this.publishContainer(igUserId, containerParsed.data.id, accessToken, content.itemId)
  }

  private async publishReels(
    igUserId: string,
    accessToken: string,
    content: PlatformContent,
    caption: string,
    videoUrl: string,
  ): Promise<PublishResult> {
    // Step 1: Create container with media_type=REELS
    const containerParams = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      share_to_feed: 'true',
      access_token: accessToken,
    })

    const containerResponse = await this.fetchFn(`${GRAPH_API_BASE}/${igUserId}/media`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: containerParams,
    })

    this.trackApiCall()

    if (!containerResponse.ok) {
      return this.handleApiError(containerResponse, content.itemId)
    }

    const containerData = await containerResponse.json()
    const containerParsed = instagramContainerResponseSchema.safeParse(containerData)
    if (!containerParsed.success) {
      return {
        success: false,
        platform: 'instagram',
        itemId: content.itemId,
        error: {
          code: 'INSTAGRAM_INVALID_RESPONSE',
          message: 'Invalid container creation response from Instagram',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    // Step 1.5: Poll status (videos take longer)
    const pollResult = await this.pollContainerStatus(containerParsed.data.id, accessToken)
    if (pollResult !== 'FINISHED') {
      return this.handleContainerFailure(containerParsed.data.id, pollResult, content.itemId)
    }

    // Step 2: Publish
    return this.publishContainer(igUserId, containerParsed.data.id, accessToken, content.itemId)
  }

  private async publishCarousel(
    igUserId: string,
    accessToken: string,
    content: PlatformContent,
    caption: string,
  ): Promise<PublishResult> {
    const media = content.content.media ?? []

    // Step 1a: Create child containers
    const childIds: string[] = []
    for (const item of media) {
      if (!item.url) continue

      const childParams = new URLSearchParams({
        is_carousel_item: 'true',
        access_token: accessToken,
      })

      if (item.type === 'video') {
        childParams.set('media_type', 'VIDEO')
        childParams.set('video_url', item.url)
      } else {
        childParams.set('image_url', item.url)
      }

      const childResponse = await this.fetchFn(`${GRAPH_API_BASE}/${igUserId}/media`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: childParams,
      })

      this.trackApiCall()

      if (!childResponse.ok) {
        return this.handleApiError(childResponse, content.itemId)
      }

      const childData = await childResponse.json()
      const childParsed = instagramContainerResponseSchema.safeParse(childData)
      if (!childParsed.success) {
        return {
          success: false,
          platform: 'instagram',
          itemId: content.itemId,
          error: {
            code: 'INSTAGRAM_INVALID_RESPONSE',
            message: 'Invalid child container response from Instagram',
            classification: 'transient',
            retryable: true,
          },
        }
      }

      childIds.push(childParsed.data.id)
    }

    // Step 1b: Create parent carousel container
    const carouselParams = new URLSearchParams({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: accessToken,
    })

    const carouselResponse = await this.fetchFn(`${GRAPH_API_BASE}/${igUserId}/media`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: carouselParams,
    })

    this.trackApiCall()

    if (!carouselResponse.ok) {
      return this.handleApiError(carouselResponse, content.itemId)
    }

    const carouselData = await carouselResponse.json()
    const carouselParsed = instagramContainerResponseSchema.safeParse(carouselData)
    if (!carouselParsed.success) {
      return {
        success: false,
        platform: 'instagram',
        itemId: content.itemId,
        error: {
          code: 'INSTAGRAM_INVALID_RESPONSE',
          message: 'Invalid carousel container response from Instagram',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    // Step 1.5: Poll parent container status
    const pollResult = await this.pollContainerStatus(carouselParsed.data.id, accessToken)
    if (pollResult !== 'FINISHED') {
      return this.handleContainerFailure(carouselParsed.data.id, pollResult, content.itemId)
    }

    // Step 2: Publish
    return this.publishContainer(igUserId, carouselParsed.data.id, accessToken, content.itemId)
  }

  private async pollContainerStatus(
    containerId: string,
    accessToken: string,
  ): Promise<ContainerStatus> {
    const startTime = Date.now()

    while (Date.now() - startTime < this.pollTimeoutMs) {
      const params = new URLSearchParams({
        fields: 'status_code',
        access_token: accessToken,
      })

      const response = await this.fetchFn(
        `${GRAPH_API_BASE}/${encodeURIComponent(containerId)}?${params.toString()}`,
      )

      this.trackApiCall()

      if (!response.ok) {
        // If status check fails, treat as still processing and retry
        await this.sleepFn(this.pollIntervalMs)
        continue
      }

      const data = await response.json()
      const parsed = instagramContainerStatusResponseSchema.safeParse(data)
      if (!parsed.success) {
        await this.sleepFn(this.pollIntervalMs)
        continue
      }

      const status = parsed.data.status_code
      if (status === 'FINISHED' || status === 'PUBLISHED') {
        return status
      }

      if (status === 'ERROR') {
        return 'ERROR'
      }

      if (status === 'EXPIRED') {
        return 'EXPIRED'
      }

      // IN_PROGRESS — keep polling
      await this.sleepFn(this.pollIntervalMs)
    }

    // Timeout — treat as still processing (the container will eventually expire)
    return 'IN_PROGRESS'
  }

  private async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string,
    itemId: string,
  ): Promise<PublishResult> {
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    })

    const response = await this.fetchFn(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: publishParams,
    })

    this.trackApiCall()
    this.trackPublish()

    if (!response.ok) {
      return this.handleApiError(response, itemId)
    }

    const data = await response.json()
    const parsed = instagramMediaPublishResponseSchema.safeParse(data)
    if (!parsed.success) {
      return {
        success: false,
        platform: 'instagram',
        itemId,
        error: {
          code: 'INSTAGRAM_INVALID_RESPONSE',
          message: 'Invalid publish response from Instagram',
          classification: 'transient',
          retryable: true,
        },
      }
    }

    return {
      success: true,
      platform: 'instagram',
      itemId,
      postId: parsed.data.id,
      postUrl: `https://www.instagram.com/p/${parsed.data.id}/`,
      publishedAt: new Date().toISOString(),
    }
  }

  private handleContainerFailure(
    containerId: string,
    status: ContainerStatus,
    itemId: string,
  ): PublishResult {
    if (status === 'EXPIRED') {
      return {
        success: false,
        platform: 'instagram',
        itemId,
        error: {
          code: 'INSTAGRAM_CONTAINER_EXPIRED',
          message: `Container ${containerId} expired before publishing`,
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    if (status === 'ERROR') {
      return {
        success: false,
        platform: 'instagram',
        itemId,
        error: {
          code: 'INSTAGRAM_CONTAINER_ERROR',
          message: `Container ${containerId} failed processing`,
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    // IN_PROGRESS (timeout)
    return {
      success: false,
      platform: 'instagram',
      itemId,
      error: {
        code: 'INSTAGRAM_CONTAINER_TIMEOUT',
        message: `Container ${containerId} status polling timed out after ${this.pollTimeoutMs}ms`,
        classification: 'transient',
        retryable: true,
      },
    }
  }

  private async handleApiError(response: Response, itemId: string): Promise<PublishResult> {
    const text = await response.text().catch(() => response.statusText)

    // Try to parse as Graph API error
    try {
      const errorData = JSON.parse(text)
      const graphError = instagramGraphErrorSchema.safeParse(errorData)
      if (graphError.success) {
        const errorCode = graphError.data.error.code
        const classification = classifyInstagramErrorCode(errorCode)
        return {
          success: false,
          platform: 'instagram',
          itemId,
          error: {
            code: `INSTAGRAM_GRAPH_${errorCode}`,
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
      platform: 'instagram',
      itemId,
      error: {
        code: `INSTAGRAM_HTTP_${response.status}`,
        message: `Instagram API error (HTTP ${response.status}): ${text}`,
        classification,
        retryable: classification === 'transient',
        retryAfterMs: classification === 'transient' ? BASE_RETRY_MS : undefined,
      },
    }
  }

  private async checkPublishingQuota(
    igUserId: string,
  ): Promise<{quotaUsage: number; quotaTotal: number} | null> {
    try {
      const entry = await this.credentialManager.retrieve('instagram')
      const params = new URLSearchParams({
        fields: 'config,quota_usage',
        access_token: entry.tokens.accessToken,
      })

      const response = await this.fetchFn(
        `${GRAPH_API_BASE}/${encodeURIComponent(igUserId)}/content_publishing_limit?${params.toString()}`,
      )

      this.trackApiCall()

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const parsed = instagramPublishingLimitSchema.safeParse(data)
      if (!parsed.success) {
        return null
      }

      return {
        quotaUsage: parsed.data.quota_usage,
        quotaTotal: parsed.data.config?.quota_total ?? INSTAGRAM_POSTS_PER_DAY,
      }
    } catch {
      return null
    }
  }

  private trackApiCall(): void {
    this.rateLimitState.apiCallCount++
    this.rateLimitState.updatedAt = Date.now()

    if (
      this.rateLimitState.apiCallsResetAt === 0 ||
      Date.now() > this.rateLimitState.apiCallsResetAt
    ) {
      this.rateLimitState.apiCallCount = 1
      this.rateLimitState.apiCallsResetAt = Date.now() + 60 * 60 * 1000 // 1 hour
    }
  }

  private trackPublish(): void {
    this.rateLimitState.publishCount++

    if (
      this.rateLimitState.publishResetAt === 0 ||
      Date.now() > this.rateLimitState.publishResetAt
    ) {
      this.rateLimitState.publishCount = 1
      this.rateLimitState.publishResetAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    }
  }

  private async throttle(): Promise<void> {
    // Throttle if approaching API call limit
    if (this.rateLimitState.apiCallCount >= INSTAGRAM_API_CALLS_PER_HOUR * 0.8) {
      const waitMs = 60_000
      this.log(`Instagram API rate limit at ${this.rateLimitState.apiCallCount}/${INSTAGRAM_API_CALLS_PER_HOUR} — throttling for 60s`)
      await this.sleepFn(waitMs)
    }

    // Throttle if approaching publish limit
    if (this.rateLimitState.publishCount >= INSTAGRAM_POSTS_PER_DAY - 5) {
      this.log(`Instagram publishing limit at ${this.rateLimitState.publishCount}/${INSTAGRAM_POSTS_PER_DAY} — approaching limit`)
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

async function defaultSelectAccount(accounts: Array<{igUserId: string; pageName: string}>): Promise<string> {
  return accounts[0]?.igUserId ?? ''
}
