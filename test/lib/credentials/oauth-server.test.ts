import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'

import { OAuthFlowHandler } from '../../../src/lib/credentials/oauth-server.js'

// Helper to make HTTP request to localhost
function makeRequest(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }))
    }).on('error', reject)
  })
}

describe('OAuthFlowHandler', () => {
  describe('constructor', () => {
    it('creates handler with platform config', () => {
      const handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: ['read', 'submit'],
      })
      expect(handler).toBeDefined()
    })
  })

  describe('startCallbackServer()', () => {
    let handler: OAuthFlowHandler
    let port: number

    beforeEach(() => {
      handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: ['read'],
      })
    })

    afterEach(async () => {
      await handler.stopServer()
    })

    it('starts server on a random port', async () => {
      port = await handler.startCallbackServer()
      expect(port).toBeGreaterThan(0)
      expect(port).toBeLessThan(65536)
    })

    it('returns the authorization URL with correct params', async () => {
      port = await handler.startCallbackServer()
      const authUrl = handler.getAuthorizationUrl()
      expect(authUrl).toContain('https://reddit.com/api/v1/authorize')
      expect(authUrl).toContain('client_id=test-id')
      expect(authUrl).toContain('redirect_uri=')
      expect(authUrl).toContain(`localhost%3A${port}`)
      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('scope=read')
    })

    it('captures authorization code from callback', async () => {
      port = await handler.startCallbackServer()
      const codePromise = handler.waitForCode()

      // Simulate OAuth redirect with authorization code
      await makeRequest(`http://localhost:${port}/callback?code=test-auth-code-123&state=${handler.getState()}`)

      const code = await codePromise
      expect(code).toBe('test-auth-code-123')
    })

    it('rejects with error from callback', async () => {
      port = await handler.startCallbackServer()
      const codePromise = handler.waitForCode()
      codePromise.catch(() => {}) // prevent unhandled rejection warning

      await makeRequest(`http://localhost:${port}/callback?error=access_denied&error_description=User+denied+access`)

      await expect(codePromise).rejects.toThrow('OAuth authorization failed')
    })

    it('rejects on state mismatch', async () => {
      port = await handler.startCallbackServer()
      const codePromise = handler.waitForCode()
      codePromise.catch(() => {}) // prevent unhandled rejection warning

      await makeRequest(`http://localhost:${port}/callback?code=test-code&state=wrong-state`)

      await expect(codePromise).rejects.toThrow('state mismatch')
    })
  })

  describe('exchangeCode()', () => {
    let handler: OAuthFlowHandler
    const mockFetch = vi.fn()

    beforeEach(async () => {
      vi.stubGlobal('fetch', mockFetch)
      handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: ['read'],
      })
      await handler.startCallbackServer()
    })

    afterEach(async () => {
      vi.unstubAllGlobals()
      await handler.stopServer()
    })

    it('exchanges authorization code for tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      })

      const tokens = await handler.exchangeCode('test-code', 'test-secret')
      expect(tokens.accessToken).toBe('new-access-token')
      expect(tokens.refreshToken).toBe('new-refresh-token')
      expect(tokens.expiresAt).toBeDefined()
    })

    it('throws on failed token exchange', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid client credentials',
      })

      await expect(handler.exchangeCode('bad-code', 'bad-secret')).rejects.toThrow('Token exchange failed')
    })
  })

  describe('waitForCodeWithTimeout()', () => {
    it('throws when server not started', () => {
      const handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: [],
      })
      expect(() => handler.waitForCodeWithTimeout()).toThrow('Server not started')
    })

    it('times out after specified duration', async () => {
      const handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: [],
      })
      await handler.startCallbackServer()

      const promise = handler.waitForCodeWithTimeout(100)
      promise.catch(() => {}) // prevent unhandled rejection
      await expect(promise).rejects.toThrow('timed out')
      await handler.stopServer()
    })
  })

  describe('stopServer()', () => {
    it('stops the callback server', async () => {
      const handler = new OAuthFlowHandler('reddit', {
        clientId: 'test-id',
        authorizationUrl: 'https://reddit.com/api/v1/authorize',
        tokenUrl: 'https://reddit.com/api/v1/access_token',
        scopes: [],
      })
      const port = await handler.startCallbackServer()
      await handler.stopServer()

      // Server should be closed — connection should fail
      await expect(makeRequest(`http://localhost:${port}/callback?code=x`)).rejects.toThrow()
    })
  })
})
