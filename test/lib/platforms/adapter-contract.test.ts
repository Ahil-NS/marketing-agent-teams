import {describe, it, expect, beforeEach} from 'vitest'

import {AdapterRegistry} from '../../../src/lib/platforms/adapter-registry.js'
import {PlatformNotRegisteredError} from '../../../src/lib/platforms/errors.js'
import {StubAdapter} from '../../../src/lib/platforms/adapters/stub-adapter.js'
import type {PlatformAdapter, PlatformContent, PlatformName} from '../../../src/lib/platforms/types.js'

/**
 * Tests that a new adapter implementing PlatformAdapter can be registered,
 * retrieved, and called through AdapterRegistry without knowing the concrete type.
 * Covers AC #2: adapters plug in without core modification.
 */
describe('Platform adapter registration contract', () => {
  let registry: AdapterRegistry

  const sampleContent: PlatformContent = {
    itemId: 'test-item-001',
    platform: 'reddit',
    content: {
      title: 'Test Post Title',
      body: 'Test post body content for validation',
      hashtags: [],
      platformMeta: {subreddit: 'test'},
    },
  }

  beforeEach(() => {
    registry = new AdapterRegistry()
  })

  describe('new adapter registration and retrieval', () => {
    it('registers a new adapter implementing PlatformAdapter and retrieves it', () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const retrieved = registry.get('reddit')
      expect(retrieved).toBe(adapter)
      expect(retrieved.platform).toBe('reddit')
    })

    it('registers adapters for all supported platforms', () => {
      const platforms: PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram']
      for (const p of platforms) {
        registry.register(new StubAdapter({platform: p}))
      }

      expect(registry.size).toBe(4)
      for (const p of platforms) {
        expect(registry.has(p)).toBe(true)
        expect(registry.get(p).platform).toBe(p)
      }
    })

    it('throws PlatformNotRegisteredError for unregistered platform', () => {
      expect(() => registry.get('reddit')).toThrow(PlatformNotRegisteredError)
    })
  })

  describe('stage-runner polymorphic adapter calls', () => {
    it('calls authenticate() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const auth = await platformAdapter.authenticate()
      expect(auth.success).toBe(true)
      expect(auth.platform).toBe('reddit')
      expect(auth.scopes).toContain('read')
    })

    it('calls validateContent() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const result = await platformAdapter.validateContent(sampleContent)
      expect(result.valid).toBe(true)
      expect(result.platform).toBe('reddit')
    })

    it('calls publish() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const result = await platformAdapter.publish(sampleContent)
      expect(result.success).toBe(true)
      expect(result.platform).toBe('reddit')
      expect(result.itemId).toBe('test-item-001')
      expect(result.postId).toBeDefined()
      expect(result.postUrl).toBeDefined()
    })

    it('calls getMetrics() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const metrics = await platformAdapter.getMetrics('post-123')
      expect(metrics.postId).toBe('post-123')
      expect(metrics.platform).toBe('reddit')
      expect(metrics.views).toBeDefined()
      expect(metrics.likes).toBeDefined()
    })

    it('calls getRateLimits() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const limits = await platformAdapter.getRateLimits()
      expect(limits.platform).toBe('reddit')
      expect(limits.remaining).toBeGreaterThan(0)
      expect(limits.limit).toBeGreaterThan(0)
    })

    it('calls disconnect() through registry without knowing concrete type', async () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      // disconnect() should not throw
      await expect(platformAdapter.disconnect()).resolves.toBeUndefined()
    })

    it('calls all methods on different platform adapters polymorphically', async () => {
      const platforms: PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram']
      for (const p of platforms) {
        registry.register(new StubAdapter({platform: p}))
      }

      for (const p of platforms) {
        const adapter: PlatformAdapter = registry.get(p)

        const auth = await adapter.authenticate()
        expect(auth.success).toBe(true)
        expect(auth.platform).toBe(p)

        const limits = await adapter.getRateLimits()
        expect(limits.platform).toBe(p)

        await expect(adapter.disconnect()).resolves.toBeUndefined()
      }
    })
  })

  describe('adapter failure scenarios through registry', () => {
    it('handles auth failure through registry', async () => {
      const adapter = new StubAdapter({platform: 'reddit', shouldFailAuth: true})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const auth = await platformAdapter.authenticate()
      expect(auth.success).toBe(false)
      expect(auth.error).toBeDefined()
    })

    it('handles publish failure through registry', async () => {
      const adapter = new StubAdapter({platform: 'reddit', shouldFailPublish: true})
      registry.register(adapter)

      const platformAdapter: PlatformAdapter = registry.get('reddit')
      const result = await platformAdapter.publish(sampleContent)
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.retryable).toBe(true)
    })
  })
})
