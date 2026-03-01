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
import type {TikTokPublishParams, TikTokRateLimitState} from './tiktok-types.js'

import {getPlatformOAuthConfig} from '../../credentials/platform-oauth-config.js'
import {validateContentForPlatform} from '../content-validator.js'
import {
  TikTokApiError,
  TikTokCreatorInfoError,
  TikTokPublishError,
  classifyHttpStatus,
  classifyTikTokErrorCode,
} from './errors.js'
import {
  buildTikTokAuthorizationUrl,
  exchangeTikTokCode,
  isTokenExpiringSoon,
  refreshTikTokToken,
  revokeTikTokToken,
} from './tiktok-auth.js'
import {
  TIKTOK_API_BASE,
  TIKTOK_RATE_LIMITS,
  tiktokCreatorInfoSchema,
  tiktokPublishInitResponseSchema,
  tiktokPublishStatusSchema,
  tiktokVideoQueryResponseSchema,
} from './tiktok-types.js'

const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_MS = 2000
const STATUS_POLL_INTERVAL_MS = 10_000
const STATUS_POLL_MAX_MS = 5 * 60 * 1000 // 5 minutes
const TIKTOK_SCOPES = ['video.publish', 'user.info.basic']

export interface TikTokAdapterOptions {
  credentialManager: CredentialManager
  /** Override fetch for testing */
  fetchFn?: typeof globalThis.fetch
  /** Override browser-open for testing */
  openBrowser?: (url: string) => Promise<void>
  /** Override console output for testing */
  log?: (message: string) => void
  /** Override sleep for testing */
  sleepFn?: (ms: number) => Promise<void>
}

export class TikTokAdapter implements PlatformAdapter {
  readonly platform = 'tiktok' as const

  private readonly credentialManager: CredentialManager
  private readonly fetchFn: typeof globalThis.fetch
  private readonly openBrowser: (url: string) => Promise<void>
  private readonly log: (message: string) => void
  private readonly sleepFn: (ms: number) => Promise<void>

  private rateLimitState: TikTokRateLimitState = {
    remaining: TIKTOK_RATE_LIMITS.PUBLISH_VIDEO_INIT.requestsPerMinute,
    resetAt: 0,
    pendingUploads: 0,
    pendingUploadsResetAt: 0,
  }

  /** Cached creator info for the session */
  private cachedCreatorInfo: {
    privacyLevelOptions: string[]
    maxVideoPostDurationSec: number
  } | null = null

  constructor(options: TikTokAdapterOptions) {
    this.credentialManager = options.credentialManager
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.openBrowser = options.openBrowser ?? defaultOpenBrowser
    this.log = options.log ?? console.log.bind(console)
    this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  }

  async authenticate(): Promise<AuthResult> {
    const oauthConfig = getPlatformOAuthConfig('tiktok')
    if (!oauthConfig) {
      return {
        success: false,
        platform: 'tiktok',
        scopes: [],
        error: 'TikTok OAuth credentials not configured. Set MAT_TIKTOK_CLIENT_ID and MAT_TIKTOK_CLIENT_SECRET environment variables.',
      }
    }

    const {clientId: clientKey, clientSecret} = oauthConfig

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
          reject(new TikTokApiError(401, `OAuth denied: ${error}`, 'permanent'))
          return
        }

        const callbackState = url.searchParams.get('state')
        if (callbackState !== state) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Security Error</h1><p>State mismatch.</p></body></html>')
          server.close()
          reject(new TikTokApiError(400, 'OAuth state mismatch', 'permanent'))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Error</h1><p>No authorization code.</p></body></html>')
          server.close()
          reject(new TikTokApiError(400, 'No authorization code received', 'permanent'))
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
    const authUrl = buildTikTokAuthorizationUrl(clientKey, redirectUri, state, TIKTOK_SCOPES)

    // Try to open browser; fall back to headless paste
    try {
      await this.openBrowser(authUrl)
      this.log('Opening browser for TikTok authorization...')
    } catch {
      this.log(`\nCannot open browser. Please visit the following URL to authorize:\n\n${authUrl}\n`)
    }

    try {
      const code = await codePromise
      const tokens = await exchangeTikTokCode(code, redirectUri, clientKey, clientSecret, this.fetchFn)
      await this.credentialManager.store('tiktok', tokens, TIKTOK_SCOPES)

      return {
        success: true,
        platform: 'tiktok',
        scopes: TIKTOK_SCOPES,
        expiresAt: tokens.expiresAt,
      }
    } catch (error) {
      return {
        success: false,
        platform: 'tiktok',
        scopes: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    // Run static constraint validation first
    const staticResult = validateContentForPlatform(content)
    const errors: ContentValidationError[] = [...staticResult.errors]
    const warnings: ContentValidationWarning[] = [...staticResult.warnings]

    const caption = content.content.body
    const title = content.content.title

    // TikTok caption: max 2,200 UTF-16 characters (this is more precise than the generic validator)
    const captionUtf16Length = getUtf16Length(caption)
    if (captionUtf16Length > 2200) {
      // Remove the generic validator's error if it exists (it may have different limits)
      const genericIdx = errors.findIndex(
        (e) => e.field === 'body' && e.constraint === 'maxLength',
      )
      if (genericIdx >= 0) errors.splice(genericIdx, 1)

      errors.push({
        field: 'body',
        constraint: 'maxLength',
        message: 'Video caption exceeds maximum of 2,200 UTF-16 characters',
        value: captionUtf16Length,
        limit: 2200,
      })
    }

    // Photo title: max 150 UTF-16 characters
    if (title) {
      const titleUtf16Length = getUtf16Length(title)
      if (titleUtf16Length > 150) {
        errors.push({
          field: 'title',
          constraint: 'maxLength',
          message: 'Photo title exceeds maximum of 150 UTF-16 characters',
          value: titleUtf16Length,
          limit: 150,
        })
      }
    }

    // Video URL must be HTTPS
    const videoUrl = getVideoUrl(content)
    if (videoUrl) {
      if (!videoUrl.startsWith('https://')) {
        errors.push({
          field: 'media.url',
          constraint: 'protocol',
          message: 'Video URL must use HTTPS protocol',
          value: videoUrl,
        })
      }
    }

    // Validate privacy level against creator info
    const requestedPrivacy = content.content.platformMeta?.['privacy_level'] as string | undefined
    if (requestedPrivacy) {
      try {
        const creatorInfo = await this.queryCreatorInfo()
        if (!creatorInfo.privacyLevelOptions.includes(requestedPrivacy)) {
          errors.push({
            field: 'platformMeta.privacy_level',
            constraint: 'allowedValues',
            message: `Privacy level '${requestedPrivacy}' is not available. Allowed: ${creatorInfo.privacyLevelOptions.join(', ')}`,
            value: requestedPrivacy,
          })
        }
      } catch {
        warnings.push({
          field: 'platformMeta.privacy_level',
          message: 'Could not verify privacy level against creator info — will validate at publish time',
        })
      }
    }

    return {
      valid: errors.length === 0,
      platform: 'tiktok',
      errors,
      warnings,
    }
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    // Check pending upload limit
    if (
      this.rateLimitState.pendingUploads >= TIKTOK_RATE_LIMITS.MAX_PENDING_UPLOADS_PER_DAY &&
      Date.now() < this.rateLimitState.pendingUploadsResetAt
    ) {
      return {
        success: false,
        platform: 'tiktok',
        itemId: content.itemId,
        error: {
          code: 'spam_risk_too_many_pending_share',
          message: `Maximum ${TIKTOK_RATE_LIMITS.MAX_PENDING_UPLOADS_PER_DAY} pending uploads per 24 hours exceeded`,
          classification: 'transient',
          retryable: true,
          retryAfterMs: this.rateLimitState.pendingUploadsResetAt - Date.now(),
        },
      }
    }

    const videoUrl = getVideoUrl(content)
    if (!videoUrl) {
      return {
        success: false,
        platform: 'tiktok',
        itemId: content.itemId,
        error: {
          code: 'TIKTOK_MISSING_VIDEO_URL',
          message: 'Video URL is required for TikTok publish (PULL_FROM_URL)',
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    // Get creator info to determine valid privacy levels
    let privacyLevel = (content.content.platformMeta?.['privacy_level'] as string) ?? ''
    try {
      const creatorInfo = await this.queryCreatorInfo()
      if (!privacyLevel || !creatorInfo.privacyLevelOptions.includes(privacyLevel)) {
        // Default to the most restrictive available option
        privacyLevel = creatorInfo.privacyLevelOptions.includes('SELF_ONLY')
          ? 'SELF_ONLY'
          : creatorInfo.privacyLevelOptions[0] ?? 'SELF_ONLY'
      }
    } catch {
      if (!privacyLevel) {
        privacyLevel = 'SELF_ONLY'
      }
    }

    const postInfo: TikTokPublishParams = {
      post_info: {
        title: content.content.body,
        privacy_level: privacyLevel,
        disable_duet: content.content.platformMeta?.['disable_duet'] === true,
        disable_stitch: content.content.platformMeta?.['disable_stitch'] === true,
        disable_comment: content.content.platformMeta?.['disable_comment'] === true,
        is_aigc: true, // Mandatory for AI-generated content
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }

    // Retry loop with exponential backoff
    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.throttle()
        await this.ensureFreshToken()

        const entry = await this.credentialManager.retrieve('tiktok')

        // POST /v2/post/publish/video/init/
        const initResponse = await this.fetchFn(
          `${TIKTOK_API_BASE}/v2/post/publish/video/init/`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${entry.tokens.accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify(postInfo),
          },
        )

        if (!initResponse.ok) {
          const classification = classifyHttpStatus(initResponse.status)
          const text = await initResponse.text().catch(() => initResponse.statusText)

          if (classification === 'transient' && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = BASE_RETRY_MS * Math.pow(2, attempt)
            await this.sleepFn(delay)
            lastError = new TikTokApiError(initResponse.status, text, classification)
            continue
          }

          return {
            success: false,
            platform: 'tiktok',
            itemId: content.itemId,
            error: {
              code: `TIKTOK_HTTP_${initResponse.status}`,
              message: `TikTok API error (HTTP ${initResponse.status}): ${text}`,
              classification,
              retryable: classification === 'transient',
              retryAfterMs: classification === 'transient' ? BASE_RETRY_MS * Math.pow(2, attempt) : undefined,
            },
          }
        }

        const initRaw = await initResponse.json()
        const initParsed = tiktokPublishInitResponseSchema.safeParse(initRaw)
        if (!initParsed.success) {
          return {
            success: false,
            platform: 'tiktok',
            itemId: content.itemId,
            error: {
              code: 'TIKTOK_INVALID_RESPONSE',
              message: 'Invalid response from TikTok publish init API',
              classification: 'transient',
              retryable: true,
            },
          }
        }

        const initResult = initParsed.data

        // Check for TikTok error in response body
        if (initResult.error.code !== 'ok' || !initResult.data) {
          const errorCode = initResult.error.code
          const classification = classifyTikTokErrorCode(errorCode)

          if (classification === 'transient' && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = BASE_RETRY_MS * Math.pow(2, attempt)
            await this.sleepFn(delay)
            lastError = new TikTokPublishError(errorCode, initResult.error.message, classification)
            continue
          }

          return {
            success: false,
            platform: 'tiktok',
            itemId: content.itemId,
            error: {
              code: errorCode,
              message: initResult.error.message,
              classification,
              retryable: classification === 'transient',
            },
          }
        }

        const publishId = initResult.data.publish_id
        this.rateLimitState.remaining = Math.max(0, this.rateLimitState.remaining - 1)
        this.rateLimitState.pendingUploads++
        if (this.rateLimitState.pendingUploadsResetAt === 0) {
          this.rateLimitState.pendingUploadsResetAt = Date.now() + 24 * 60 * 60 * 1000
        }

        // Poll for publish status
        const statusResult = await this.pollPublishStatus(publishId, entry.tokens.accessToken)

        if (statusResult.success) {
          return {
            success: true,
            platform: 'tiktok',
            itemId: content.itemId,
            postId: publishId,
            publishedAt: new Date().toISOString(),
          }
        }

        return {
          success: false,
          platform: 'tiktok',
          itemId: content.itemId,
          postId: publishId,
          error: statusResult.error,
        }
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
      platform: 'tiktok',
      itemId: content.itemId,
      error: {
        code: 'TIKTOK_MAX_RETRIES',
        message: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message ?? 'Unknown error'}`,
        classification: 'transient',
        retryable: false,
      },
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    await this.ensureFreshToken()
    const entry = await this.credentialManager.retrieve('tiktok')

    const response = await this.fetchFn(
      `${TIKTOK_API_BASE}/v2/video/query/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${entry.tokens.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          filters: {video_ids: [postId]},
        }),
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new TikTokApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    const parsed = tiktokVideoQueryResponseSchema.safeParse(rawData)
    if (!parsed.success || !parsed.data.data?.videos?.length) {
      return {
        postId,
        platform: 'tiktok',
        retrievedAt: new Date().toISOString(),
      }
    }

    const video = parsed.data.data.videos[0]!

    return {
      postId,
      platform: 'tiktok',
      views: video.view_count,
      likes: video.like_count,
      comments: video.comment_count,
      shares: video.share_count,
      retrievedAt: new Date().toISOString(),
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: 'tiktok',
      remaining: this.rateLimitState.remaining,
      limit: TIKTOK_RATE_LIMITS.PUBLISH_VIDEO_INIT.requestsPerMinute,
      resetsAt: new Date(this.rateLimitState.resetAt).toISOString(),
      windowType: 'minute',
    }
  }

  async disconnect(): Promise<void> {
    const oauthConfig = getPlatformOAuthConfig('tiktok')

    try {
      const entry = await this.credentialManager.retrieve('tiktok')
      if (oauthConfig && entry.tokens.accessToken) {
        await revokeTikTokToken(
          entry.tokens.accessToken,
          oauthConfig.clientId,
          oauthConfig.clientSecret,
          this.fetchFn,
        )
      }
    } catch {
      // Ignore revocation failure — still remove local credentials
    }

    await this.credentialManager.remove('tiktok')
  }

  /**
   * Query the creator's publishing capabilities (privacy levels, max duration).
   * Results are cached for the session.
   */
  async queryCreatorInfo(): Promise<{privacyLevelOptions: string[]; maxVideoPostDurationSec: number}> {
    if (this.cachedCreatorInfo) return this.cachedCreatorInfo

    await this.ensureFreshToken()
    const entry = await this.credentialManager.retrieve('tiktok')

    const response = await this.fetchFn(
      `${TIKTOK_API_BASE}/v2/post/publish/creator_info/query/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${entry.tokens.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({}),
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new TikTokCreatorInfoError(`HTTP ${response.status}: ${text}`)
    }

    const rawData = await response.json()
    const parsed = tiktokCreatorInfoSchema.safeParse(rawData)
    if (!parsed.success) {
      throw new TikTokCreatorInfoError(`Invalid response: ${parsed.error.message}`)
    }

    if (parsed.data.error.code !== 'ok') {
      throw new TikTokCreatorInfoError(`${parsed.data.error.code}: ${parsed.data.error.message}`)
    }

    this.cachedCreatorInfo = {
      privacyLevelOptions: parsed.data.data.privacy_level_options,
      maxVideoPostDurationSec: parsed.data.data.max_video_post_duration_sec,
    }

    return this.cachedCreatorInfo
  }

  // --- Internal helpers ---

  private async ensureFreshToken(): Promise<void> {
    try {
      const entry = await this.credentialManager.retrieve('tiktok')
      if (!isTokenExpiringSoon(entry.tokens.expiresAt)) return

      const oauthConfig = getPlatformOAuthConfig('tiktok')
      if (!oauthConfig || !entry.tokens.refreshToken) return

      const newTokens = await refreshTikTokToken(
        entry.tokens.refreshToken,
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        this.fetchFn,
      )

      // TikTok may rotate the refresh token — always persist the new one
      await this.credentialManager.store('tiktok', newTokens, TIKTOK_SCOPES)
    } catch {
      // If refresh fails, continue with existing token — let the API call fail naturally
    }
  }

  private async throttle(): Promise<void> {
    if (this.rateLimitState.remaining <= 1) {
      const waitMs = this.rateLimitState.resetAt - Date.now() + 1000
      if (waitMs > 0) {
        await this.sleepFn(waitMs)
      }

      // Reset rate limit window
      this.rateLimitState.remaining = TIKTOK_RATE_LIMITS.PUBLISH_VIDEO_INIT.requestsPerMinute
      this.rateLimitState.resetAt = Date.now() + 60_000
    }
  }

  private async pollPublishStatus(
    publishId: string,
    accessToken: string,
  ): Promise<{success: boolean; error?: PublishResult['error']}> {
    const startTime = Date.now()
    let pollInterval = STATUS_POLL_INTERVAL_MS
    let attempt = 0

    while (Date.now() - startTime < STATUS_POLL_MAX_MS) {
      await this.sleepFn(pollInterval)

      try {
        const response = await this.fetchFn(
          `${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({publish_id: publishId}),
          },
        )

        if (!response.ok) {
          attempt++
          pollInterval = Math.min(STATUS_POLL_INTERVAL_MS * Math.pow(1.5, attempt), 60_000)
          continue
        }

        const rawData = await response.json()
        const parsed = tiktokPublishStatusSchema.safeParse(rawData)
        if (!parsed.success) {
          attempt++
          pollInterval = Math.min(STATUS_POLL_INTERVAL_MS * Math.pow(1.5, attempt), 60_000)
          continue
        }

        const statusData = parsed.data

        if (statusData.error.code !== 'ok') {
          const classification = classifyTikTokErrorCode(statusData.error.code)
          return {
            success: false,
            error: {
              code: statusData.error.code,
              message: statusData.error.message,
              classification,
              retryable: classification === 'transient',
            },
          }
        }

        if (!statusData.data) {
          attempt++
          pollInterval = Math.min(STATUS_POLL_INTERVAL_MS * Math.pow(1.5, attempt), 60_000)
          continue
        }

        const status = statusData.data.status

        if (status === 'PUBLISH_COMPLETE') {
          this.rateLimitState.pendingUploads = Math.max(0, this.rateLimitState.pendingUploads - 1)
          return {success: true}
        }

        if (status === 'FAILED') {
          const failReason = statusData.data.fail_reason ?? 'Unknown failure reason'
          const classification = classifyTikTokErrorCode(failReason)
          return {
            success: false,
            error: {
              code: failReason,
              message: `TikTok publish failed: ${failReason}`,
              classification,
              retryable: classification === 'transient',
            },
          }
        }

        // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, etc. → keep polling
        attempt++
        pollInterval = Math.min(STATUS_POLL_INTERVAL_MS * Math.pow(1.5, attempt), 60_000)
      } catch {
        attempt++
        pollInterval = Math.min(STATUS_POLL_INTERVAL_MS * Math.pow(1.5, attempt), 60_000)
      }
    }

    // Timed out
    return {
      success: false,
      error: {
        code: 'TIKTOK_PUBLISH_TIMEOUT',
        message: `Publish status polling timed out after ${STATUS_POLL_MAX_MS / 1000} seconds`,
        classification: 'transient',
        retryable: true,
        retryAfterMs: STATUS_POLL_INTERVAL_MS,
      },
    }
  }
}

/**
 * Get UTF-16 code unit length (how JavaScript/TikTok measures string length).
 */
function getUtf16Length(str: string): number {
  // JavaScript's .length already returns UTF-16 code units
  return str.length
}

/**
 * Extract video URL from PlatformContent (from media attachments).
 */
function getVideoUrl(content: PlatformContent): string | undefined {
  const videoMedia = content.content.media?.find((m) => m.type === 'video')
  return videoMedia?.url ?? (content.content.platformMeta?.['video_url'] as string | undefined)
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
