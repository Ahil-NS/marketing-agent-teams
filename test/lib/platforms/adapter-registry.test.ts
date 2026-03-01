import {describe, it, expect, beforeEach} from 'vitest'

import {AdapterRegistry} from '../../../src/lib/platforms/adapter-registry.js'
import {PlatformNotRegisteredError} from '../../../src/lib/platforms/errors.js'
import {StubAdapter} from '../../../src/lib/platforms/adapters/stub-adapter.js'
import type {PlatformName} from '../../../src/lib/platforms/types.js'

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry

  beforeEach(() => {
    registry = new AdapterRegistry()
  })

  describe('register', () => {
    it('registers an adapter', () => {
      const adapter = new StubAdapter({platform: 'reddit'})
      registry.register(adapter)
      expect(registry.has('reddit')).toBe(true)
    })

    it('overwrites existing adapter for same platform', () => {
      const adapter1 = new StubAdapter({platform: 'reddit'})
      const adapter2 = new StubAdapter({platform: 'reddit', shouldFailAuth: true})
      registry.register(adapter1)
      registry.register(adapter2)
      expect(registry.size).toBe(1)
    })
  })

  describe('get', () => {
    it('returns registered adapter', () => {
      const adapter = new StubAdapter({platform: 'tiktok'})
      registry.register(adapter)
      const retrieved = registry.get('tiktok')
      expect(retrieved.platform).toBe('tiktok')
    })

    it('throws PlatformNotRegisteredError for unregistered platform', () => {
      expect(() => registry.get('instagram')).toThrow(PlatformNotRegisteredError)
    })

    it('error has correct code', () => {
      try {
        registry.get('facebook')
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformNotRegisteredError)
        expect((error as PlatformNotRegisteredError).code).toBe('PLATFORM_NOT_REGISTERED')
      }
    })
  })

  describe('getAll', () => {
    it('returns empty array when no adapters registered', () => {
      expect(registry.getAll()).toEqual([])
    })

    it('returns all registered adapters', () => {
      const platforms: PlatformName[] = ['reddit', 'tiktok', 'facebook', 'instagram']
      for (const p of platforms) {
        registry.register(new StubAdapter({platform: p}))
      }

      const all = registry.getAll()
      expect(all).toHaveLength(4)
      const names = all.map((a) => a.platform).sort()
      expect(names).toEqual(['facebook', 'instagram', 'reddit', 'tiktok'])
    })
  })

  describe('has', () => {
    it('returns false for unregistered platform', () => {
      expect(registry.has('reddit')).toBe(false)
    })

    it('returns true for registered platform', () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      expect(registry.has('reddit')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('removes a registered adapter', () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      expect(registry.unregister('reddit')).toBe(true)
      expect(registry.has('reddit')).toBe(false)
    })

    it('returns false for unregistered platform', () => {
      expect(registry.unregister('tiktok')).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all adapters', () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      registry.register(new StubAdapter({platform: 'tiktok'}))
      registry.clear()
      expect(registry.size).toBe(0)
      expect(registry.getAll()).toEqual([])
    })
  })

  describe('size', () => {
    it('returns 0 when empty', () => {
      expect(registry.size).toBe(0)
    })

    it('returns correct count', () => {
      registry.register(new StubAdapter({platform: 'reddit'}))
      registry.register(new StubAdapter({platform: 'tiktok'}))
      expect(registry.size).toBe(2)
    })
  })
})
