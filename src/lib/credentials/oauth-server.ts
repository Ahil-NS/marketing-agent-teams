import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { URL } from 'node:url'

import type { Platform, TokenData } from './types.js'
import { MATError } from '../utils/errors.js'

export const CREDENTIAL_OAUTH_FAILED = 'CREDENTIAL_OAUTH_FAILED'

export interface OAuthPlatformConfig {
  clientId: string
  authorizationUrl: string
  tokenUrl: string
  scopes: string[]
}

export class OAuthFlowHandler {
  private readonly platform: Platform
  private readonly config: OAuthPlatformConfig
  private readonly state: string
  private server: ReturnType<typeof createServer> | null = null
  private port = 0
  private codePromise: Promise<string> | null = null
  private codeResolve: ((code: string) => void) | null = null
  private codeReject: ((error: Error) => void) | null = null

  constructor(platform: Platform, config: OAuthPlatformConfig) {
    this.platform = platform
    this.config = config
    this.state = randomBytes(16).toString('hex')
  }

  getState(): string {
    return this.state
  }

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `http://localhost:${this.port}/callback`,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state: this.state,
    })
    return `${this.config.authorizationUrl}?${params.toString()}`
  }

  startCallbackServer(): Promise<number> {
    this.codePromise = new Promise<string>((resolve, reject) => {
      this.codeResolve = resolve
      this.codeReject = reject
    })

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400)
          res.end('Bad request')
          return
        }

        const url = new URL(req.url, `http://localhost:${this.port}`)

        if (!url.pathname.startsWith('/callback')) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const error = url.searchParams.get('error')
        if (error) {
          const description = url.searchParams.get('error_description') ?? error
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Authorization Failed</h1><p>You can close this window.</p></body></html>')
          this.codeReject?.(
            new MATError(
              `OAuth authorization failed for ${this.platform}: ${description}`,
              CREDENTIAL_OAUTH_FAILED,
              `${error}: ${description}`,
              `Re-run "mat config platforms add ${this.platform}" and approve the authorization request.`,
              'credentials',
              'transient',
            ),
          )
          return
        }

        const callbackState = url.searchParams.get('state')
        if (callbackState !== this.state) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Security Error</h1><p>State mismatch. You can close this window.</p></body></html>')
          this.codeReject?.(
            new MATError(
              `OAuth state mismatch for ${this.platform}`,
              CREDENTIAL_OAUTH_FAILED,
              'The state parameter in the callback did not match. This may indicate a CSRF attack.',
              `Re-run "mat config platforms add ${this.platform}" to try again.`,
              'credentials',
              'permanent',
            ),
          )
          return
        }

        const code = url.searchParams.get('code')
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>')
          this.codeReject?.(
            new MATError(
              `No authorization code received for ${this.platform}`,
              CREDENTIAL_OAUTH_FAILED,
              'The callback did not include an authorization code.',
              `Re-run "mat config platforms add ${this.platform}" to try again.`,
              'credentials',
              'transient',
            ),
          )
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Authorization Successful</h1><p>You can close this window and return to the CLI.</p></body></html>')
        this.codeResolve?.(code)
      })

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address()
        if (address && typeof address === 'object') {
          this.port = address.port
          resolve(this.port)
        } else {
          reject(new Error('Failed to get server address'))
        }
      })

      this.server.on('error', reject)
    })
  }

  waitForCode(): Promise<string> {
    if (!this.codePromise) {
      throw new MATError(
        'Server not started',
        CREDENTIAL_OAUTH_FAILED,
        'waitForCode() called before startCallbackServer()',
        'Call startCallbackServer() first.',
        'credentials',
        'permanent',
      )
    }
    return this.codePromise
  }

  async exchangeCode(code: string, clientSecret: string): Promise<TokenData> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `http://localhost:${this.port}/callback`,
        client_id: this.config.clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new MATError(
        `Token exchange failed for ${this.platform}`,
        CREDENTIAL_OAUTH_FAILED,
        `${this.config.tokenUrl} returned ${response.status}: ${text}`,
        `Check your OAuth client credentials and try again with "mat config platforms add ${this.platform}".`,
        'credentials',
        'transient',
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    const accessToken = data.access_token as string
    const refreshToken = (data.refresh_token as string) ?? ''
    const expiresIn = (data.expires_in as number) ?? 3600

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    }
  }

  waitForCodeWithTimeout(timeoutMs = 300_000): Promise<string> {
    if (!this.codePromise) {
      throw new MATError(
        'Server not started',
        CREDENTIAL_OAUTH_FAILED,
        'waitForCodeWithTimeout() called before startCallbackServer()',
        'Call startCallbackServer() first.',
        'credentials',
        'permanent',
      )
    }

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(
          new MATError(
            `OAuth flow timed out for ${this.platform}`,
            CREDENTIAL_OAUTH_FAILED,
            `No authorization callback received within ${timeoutMs / 1000} seconds.`,
            `Re-run "mat config platforms add ${this.platform}" and complete authorization in your browser.`,
            'credentials',
            'transient',
          ),
        )
      }, timeoutMs)
    })

    return Promise.race([this.codePromise, timeoutPromise])
  }

  async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}
