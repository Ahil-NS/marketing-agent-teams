import type {CredentialManager} from '../../credentials/credential-manager.js'
import type {
  AuthResult,
  ContentValidationResult,
  PlatformAdapter,
  PlatformContent,
  PlatformMetrics,
  PublishResult,
  RateLimitStatus,
} from '../types.js'
import type {RedditRateLimitState, RedditSubmitParams} from './reddit-types.js'

import {getPlatformOAuthConfig} from '../../credentials/platform-oauth-config.js'
import {validateContentForPlatform} from '../content-validator.js'
import {
  RedditApiError,
  RedditSubmitError,
  classifyHttpStatus,
} from './errors.js'
import {
  buildRedditAuthorizationUrl,
  buildUserAgent,
  exchangeRedditCode,
  isTokenExpiringSoon,
  refreshRedditToken,
  revokeRedditToken,
} from './reddit-auth.js'
import {
  redditFlairTemplatesSchema,
  redditPostInfoSchema,
  redditPostRequirementsSchema,
  redditSubmitResponseSchema,
} from './reddit-types.js'

import type {ContentValidationError} from '../types.js'

const REDDIT_API_BASE = 'https://oauth.reddit.com'
const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_MS = 2000
const THROTTLE_FLOOR = 5
const APP_VERSION = 'v1.0.0'

export interface RedditAdapterOptions {
  credentialManager: CredentialManager
  redditUsername?: string
  /** Override fetch for testing */
  fetchFn?: typeof globalThis.fetch
  /** Override browser-open for testing */
  openBrowser?: (url: string) => Promise<void>
  /** Override console output for testing */
  log?: (message: string) => void
}

export class RedditAdapter implements PlatformAdapter {
  readonly platform = 'reddit' as const

  private readonly credentialManager: CredentialManager
  private readonly redditUsername?: string
  private readonly fetchFn: typeof globalThis.fetch
  private readonly openBrowser: (url: string) => Promise<void>
  private readonly log: (message: string) => void

  private rateLimitState: RedditRateLimitState = {
    remaining: 60,
    resetAt: 0,
    used: 0,
  }

  constructor(options: RedditAdapterOptions) {
    this.credentialManager = options.credentialManager
    this.redditUsername = options.redditUsername
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis)
    this.openBrowser = options.openBrowser ?? defaultOpenBrowser
    this.log = options.log ?? console.log.bind(console)
  }

  async authenticate(): Promise<AuthResult> {
    const oauthConfig = getPlatformOAuthConfig('reddit')
    if (!oauthConfig) {
      return {
        success: false,
        platform: 'reddit',
        scopes: [],
        error: 'Reddit OAuth credentials not configured. Set MAT_REDDIT_CLIENT_ID and MAT_REDDIT_CLIENT_SECRET environment variables.',
      }
    }

    const {clientId, clientSecret, config} = oauthConfig
    const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)

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
          reject(new RedditApiError(401, `OAuth denied: ${error}`, 'permanent'))
          return
        }

        const callbackState = url.searchParams.get('state')
        if (callbackState !== state) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Security Error</h1><p>State mismatch.</p></body></html>')
          server.close()
          reject(new RedditApiError(400, 'OAuth state mismatch', 'permanent'))
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(200, {'Content-Type': 'text/html'})
          res.end('<html><body><h1>Error</h1><p>No authorization code.</p></body></html>')
          server.close()
          reject(new RedditApiError(400, 'No authorization code received', 'permanent'))
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

    // Build auth URL with duration=permanent for refresh token
    const redirectUri = `http://localhost:${port}/callback`
    const authUrl = buildRedditAuthorizationUrl(clientId, redirectUri, state, config.scopes)

    // Try to open browser; fall back to headless paste
    try {
      await this.openBrowser(authUrl)
      this.log(`Opening browser for Reddit authorization...`)
    } catch {
      this.log(`\nCannot open browser. Please visit the following URL to authorize:\n\n${authUrl}\n`)
    }

    try {
      const code = await codePromise
      const tokens = await exchangeRedditCode(code, redirectUri, clientId, clientSecret, userAgent)
      await this.credentialManager.store('reddit', tokens, config.scopes)

      return {
        success: true,
        platform: 'reddit',
        scopes: config.scopes,
        expiresAt: tokens.expiresAt,
      }
    } catch (error) {
      return {
        success: false,
        platform: 'reddit',
        scopes: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    // Run static constraint validation first
    const staticResult = validateContentForPlatform(content)
    const errors: ContentValidationError[] = [...staticResult.errors]
    const warnings = [...staticResult.warnings]

    const subreddit = content.content.platformMeta?.['subreddit'] as string | undefined

    // Call Reddit API for dynamic per-subreddit rules
    if (subreddit) {
      try {
        const requirements = await this.fetchPostRequirements(subreddit)

        // Flair requirement check
        if (requirements.is_flair_required && !content.content.platformMeta?.['flair_id']) {
          errors.push({
            field: 'platformMeta.flair_id',
            constraint: 'required',
            message: `Subreddit r/${subreddit} requires a post flair`,
          })
        }

        // Body restriction policy
        if (requirements.body_restriction_policy === 'required' && (!content.content.body || content.content.body.length === 0)) {
          errors.push({
            field: 'body',
            constraint: 'required',
            message: `Subreddit r/${subreddit} requires a post body`,
          })
        }

        if (requirements.body_restriction_policy === 'notAllowed' && content.content.body && content.content.body.length > 0) {
          errors.push({
            field: 'body',
            constraint: 'notAllowed',
            message: `Subreddit r/${subreddit} does not allow post body text (link posts only)`,
          })
        }

        // Blacklisted strings check
        if (requirements.body_blacklisted_strings.length > 0 && content.content.body) {
          for (const blacklisted of requirements.body_blacklisted_strings) {
            if (content.content.body.toLowerCase().includes(blacklisted.toLowerCase())) {
              errors.push({
                field: 'body',
                constraint: 'blacklisted',
                message: `Body contains blacklisted string: "${blacklisted}"`,
                value: blacklisted,
              })
            }
          }
        }

        // Title length check from subreddit-specific rules
        if (content.content.title) {
          if (requirements.title_text_min_length > 0 && content.content.title.length < requirements.title_text_min_length) {
            errors.push({
              field: 'title',
              constraint: 'minLength',
              message: `Title must be at least ${requirements.title_text_min_length} characters for r/${subreddit}`,
              value: content.content.title.length,
              limit: requirements.title_text_min_length,
            })
          }
        }
      } catch {
        // If we can't fetch subreddit rules, continue with static validation only
        warnings.push({
          field: 'subreddit',
          message: `Could not fetch post requirements for r/${subreddit} — skipping dynamic validation`,
        })
      }
    }

    return {
      valid: errors.length === 0,
      platform: 'reddit',
      errors,
      warnings,
    }
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    const subreddit = content.content.platformMeta?.['subreddit'] as string | undefined
    if (!subreddit) {
      return {
        success: false,
        platform: 'reddit',
        itemId: content.itemId,
        error: {
          code: 'REDDIT_MISSING_SUBREDDIT',
          message: 'Subreddit is required for Reddit posts',
          classification: 'permanent',
          retryable: false,
        },
      }
    }

    const params: RedditSubmitParams = {
      api_type: 'json',
      kind: content.content.platformMeta?.['kind'] === 'link' ? 'link' : 'self',
      sr: subreddit,
      title: content.content.title ?? '',
      sendreplies: true,
    }

    if (params.kind === 'self') {
      params.text = content.content.body
    } else {
      params.url = content.content.platformMeta?.['url'] as string | undefined
    }

    if (content.content.platformMeta?.['flair_id']) {
      params.flair_id = content.content.platformMeta['flair_id'] as string
    }

    if (content.content.platformMeta?.['flair_text']) {
      params.flair_text = content.content.platformMeta['flair_text'] as string
    }

    if (content.content.platformMeta?.['nsfw'] !== undefined) {
      params.nsfw = Boolean(content.content.platformMeta['nsfw'])
    }

    if (content.content.platformMeta?.['spoiler'] !== undefined) {
      params.spoiler = Boolean(content.content.platformMeta['spoiler'])
    }

    // Retry loop with exponential backoff for transient errors
    let lastError: Error | undefined
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.throttle()
        await this.ensureFreshToken()

        const entry = await this.credentialManager.retrieve('reddit')
        const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)

        const body = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            body.set(key, String(value))
          }
        }

        const response = await this.fetchFn(`${REDDIT_API_BASE}/api/submit`, {
          method: 'POST',
          headers: {
            'Authorization': `bearer ${entry.tokens.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': userAgent,
          },
          body,
        })

        this.updateRateLimits(response.headers)

        if (!response.ok) {
          const classification = classifyHttpStatus(response.status)
          const text = await response.text().catch(() => response.statusText)

          if (classification === 'transient' && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = BASE_RETRY_MS * Math.pow(2, attempt)
            await new Promise((r) => setTimeout(r, delay))
            lastError = new RedditApiError(response.status, text, classification)
            continue
          }

          return {
            success: false,
            platform: 'reddit',
            itemId: content.itemId,
            error: {
              code: `REDDIT_HTTP_${response.status}`,
              message: `Reddit API error (HTTP ${response.status}): ${text}`,
              classification,
              retryable: classification === 'transient',
              retryAfterMs: classification === 'transient' ? BASE_RETRY_MS * Math.pow(2, attempt) : undefined,
            },
          }
        }

        const rawData = await response.json()
        const parsed = redditSubmitResponseSchema.safeParse(rawData)
        if (!parsed.success) {
          return {
            success: false,
            platform: 'reddit',
            itemId: content.itemId,
            error: {
              code: 'REDDIT_INVALID_RESPONSE',
              message: 'Invalid response from Reddit submit API',
              classification: 'transient',
              retryable: true,
            },
          }
        }

        const result = parsed.data

        // Check for Reddit submit errors
        if (result.json.errors.length > 0) {
          const submitError = new RedditSubmitError(result.json.errors)

          if (submitError.severity === 'transient' && attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delay = BASE_RETRY_MS * Math.pow(2, attempt)
            await new Promise((r) => setTimeout(r, delay))
            lastError = submitError
            continue
          }

          return {
            success: false,
            platform: 'reddit',
            itemId: content.itemId,
            error: {
              code: result.json.errors[0]?.[0] ?? 'REDDIT_SUBMIT_ERROR',
              message: submitError.message,
              classification: submitError.severity,
              retryable: submitError.severity === 'transient',
            },
          }
        }

        if (!result.json.data) {
          return {
            success: false,
            platform: 'reddit',
            itemId: content.itemId,
            error: {
              code: 'REDDIT_NO_DATA',
              message: 'Reddit submit response missing data',
              classification: 'transient',
              retryable: true,
            },
          }
        }

        return {
          success: true,
          platform: 'reddit',
          itemId: content.itemId,
          postId: result.json.data.name,
          postUrl: result.json.data.url,
          publishedAt: new Date().toISOString(),
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          const delay = BASE_RETRY_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
    }

    return {
      success: false,
      platform: 'reddit',
      itemId: content.itemId,
      error: {
        code: 'REDDIT_MAX_RETRIES',
        message: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message ?? 'Unknown error'}`,
        classification: 'transient',
        retryable: false,
      },
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    await this.ensureFreshToken()
    const entry = await this.credentialManager.retrieve('reddit')
    const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)

    const response = await this.fetchFn(`${REDDIT_API_BASE}/api/info?id=${encodeURIComponent(postId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${entry.tokens.accessToken}`,
        'User-Agent': userAgent,
      },
    })

    this.updateRateLimits(response.headers)

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new RedditApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    const parsed = redditPostInfoSchema.safeParse(rawData)
    if (!parsed.success || parsed.data.data.children.length === 0) {
      return {
        postId,
        platform: 'reddit',
        retrievedAt: new Date().toISOString(),
      }
    }

    const postData = parsed.data.data.children[0]!.data

    return {
      postId,
      platform: 'reddit',
      likes: postData.score,
      comments: postData.num_comments,
      engagementRate: postData.upvote_ratio,
      retrievedAt: new Date().toISOString(),
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: 'reddit',
      remaining: this.rateLimitState.remaining,
      limit: 60,
      resetsAt: new Date(this.rateLimitState.resetAt).toISOString(),
      windowType: 'minute',
    }
  }

  async disconnect(): Promise<void> {
    const oauthConfig = getPlatformOAuthConfig('reddit')

    try {
      const entry = await this.credentialManager.retrieve('reddit')
      if (oauthConfig && entry.tokens.refreshToken) {
        const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)
        await revokeRedditToken(
          entry.tokens.refreshToken,
          'refresh_token',
          oauthConfig.clientId,
          oauthConfig.clientSecret,
          userAgent,
        )
      }
    } catch {
      // Ignore revocation failure — still remove local credentials
    }

    await this.credentialManager.remove('reddit')
  }

  // --- Internal helpers ---

  private async ensureFreshToken(): Promise<void> {
    try {
      const entry = await this.credentialManager.retrieve('reddit')
      if (!isTokenExpiringSoon(entry.tokens.expiresAt)) return

      const oauthConfig = getPlatformOAuthConfig('reddit')
      if (!oauthConfig || !entry.tokens.refreshToken) return

      const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)
      const newTokens = await refreshRedditToken(
        entry.tokens.refreshToken,
        oauthConfig.clientId,
        oauthConfig.clientSecret,
        userAgent,
      )

      await this.credentialManager.store('reddit', newTokens, oauthConfig.config.scopes)
    } catch {
      // If refresh fails, continue with existing token — let the API call fail naturally
    }
  }

  private async throttle(): Promise<void> {
    if (this.rateLimitState.remaining <= THROTTLE_FLOOR) {
      const waitMs = this.rateLimitState.resetAt - Date.now() + 1000
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs))
      }
    }
  }

  private updateRateLimits(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining')
    const reset = headers.get('x-ratelimit-reset')
    const used = headers.get('x-ratelimit-used')

    if (remaining) this.rateLimitState.remaining = Number.parseFloat(remaining)
    if (reset) this.rateLimitState.resetAt = Date.now() + Number.parseFloat(reset) * 1000
    if (used) this.rateLimitState.used = Number.parseInt(used, 10)
  }

  private async fetchPostRequirements(subreddit: string) {
    const entry = await this.credentialManager.retrieve('reddit')
    const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)

    const response = await this.fetchFn(
      `${REDDIT_API_BASE}/api/v1/${encodeURIComponent(subreddit)}/post_requirements`,
      {
        method: 'GET',
        headers: {
          'Authorization': `bearer ${entry.tokens.accessToken}`,
          'User-Agent': userAgent,
        },
      },
    )

    this.updateRateLimits(response.headers)

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new RedditApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    return redditPostRequirementsSchema.parse(rawData)
  }

  async fetchFlairTemplates(subreddit: string) {
    const entry = await this.credentialManager.retrieve('reddit')
    const userAgent = buildUserAgent(APP_VERSION, this.redditUsername)

    const response = await this.fetchFn(
      `${REDDIT_API_BASE}/r/${encodeURIComponent(subreddit)}/api/link_flair_v2`,
      {
        method: 'GET',
        headers: {
          'Authorization': `bearer ${entry.tokens.accessToken}`,
          'User-Agent': userAgent,
        },
      },
    )

    this.updateRateLimits(response.headers)

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new RedditApiError(response.status, text, classifyHttpStatus(response.status))
    }

    const rawData = await response.json()
    return redditFlairTemplatesSchema.parse(rawData)
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
