import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {mkdtemp, rm, readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {
  TrustOverrideStore,
  TrustOverrideError,
  trustOverrideSchema,
  trustOverridesFileSchema,
  TRUST_OVERRIDE_INVALID_PROMOTION,
  TRUST_OVERRIDE_BUILTIN_IMMUTABLE,
  TRUST_OVERRIDE_CORRUPTED,
} from '../../../src/lib/credentials/trust-overrides.js'

describe('trust-overrides', () => {
  let tmpDir: string
  let store: TrustOverrideStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-trust-test-'))
    store = new TrustOverrideStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('trustOverrideSchema', () => {
    it('validates a correct override entry', () => {
      const result = trustOverrideSchema.safeParse({
        trustTier: 'verified',
        promotedAt: '2026-03-01T00:00:00.000Z',
        promotedBy: 'user',
        reason: 'Code reviewed',
      })
      expect(result.success).toBe(true)
    })

    it('rejects builtin as trust tier', () => {
      const result = trustOverrideSchema.safeParse({
        trustTier: 'builtin',
        promotedAt: '2026-03-01T00:00:00.000Z',
        promotedBy: 'user',
        reason: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing required fields', () => {
      const result = trustOverrideSchema.safeParse({trustTier: 'verified'})
      expect(result.success).toBe(false)
    })
  })

  describe('trustOverridesFileSchema', () => {
    it('validates full file with multiple overrides', () => {
      const result = trustOverridesFileSchema.safeParse({
        '@community/agent-a': {
          trustTier: 'verified',
          promotedAt: '2026-03-01T00:00:00.000Z',
          promotedBy: 'user',
          reason: 'Reviewed',
        },
        '@community/agent-b': {
          trustTier: 'community',
          promotedAt: '2026-03-01T00:00:00.000Z',
          promotedBy: 'user',
          reason: 'Reset',
        },
      })
      expect(result.success).toBe(true)
    })

    it('validates empty record', () => {
      const result = trustOverridesFileSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('loadOverrides', () => {
    it('returns empty record when file does not exist', async () => {
      const result = await store.loadOverrides()
      expect(result).toEqual({})
    })

    it('returns overrides from saved file', async () => {
      await store.setOverride('@community/test', 'verified', 'user', 'Tested')
      const result = await store.loadOverrides()
      expect(result['@community/test']).toBeDefined()
      expect(result['@community/test'].trustTier).toBe('verified')
    })
  })

  describe('setOverride', () => {
    it('creates override for community agent to verified', async () => {
      const override = await store.setOverride(
        '@community/agent',
        'verified',
        'admin',
        'Code reviewed and approved',
      )
      expect(override.trustTier).toBe('verified')
      expect(override.promotedBy).toBe('admin')
      expect(override.reason).toBe('Code reviewed and approved')
      expect(override.promotedAt).toBeTruthy()
    })

    it('persists override to disk', async () => {
      await store.setOverride('@community/agent', 'verified')
      const raw = await readFile(join(tmpDir, 'config', 'trust-overrides.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed['@community/agent'].trustTier).toBe('verified')
    })

    it('throws when promoting to builtin', async () => {
      await expect(
        store.setOverride('@community/agent', 'builtin'),
      ).rejects.toThrow(TrustOverrideError)

      try {
        await store.setOverride('@community/agent', 'builtin')
      } catch (error) {
        expect(error).toBeInstanceOf(TrustOverrideError)
        expect((error as TrustOverrideError).code).toBe(TRUST_OVERRIDE_INVALID_PROMOTION)
      }
    })

    it('throws when modifying builtin agent', async () => {
      await expect(
        store.setOverride('trend-scout', 'verified', 'user', 'Test', true),
      ).rejects.toThrow(TrustOverrideError)

      try {
        await store.setOverride('trend-scout', 'verified', 'user', 'Test', true)
      } catch (error) {
        expect(error).toBeInstanceOf(TrustOverrideError)
        expect((error as TrustOverrideError).code).toBe(TRUST_OVERRIDE_BUILTIN_IMMUTABLE)
      }
    })

    it('overwrites existing override', async () => {
      await store.setOverride('@community/agent', 'verified', 'user', 'First')
      await store.setOverride('@community/agent', 'community', 'admin', 'Reverted')
      const override = await store.getOverride('@community/agent')
      expect(override?.trustTier).toBe('community')
      expect(override?.promotedBy).toBe('admin')
      expect(override?.reason).toBe('Reverted')
    })

    it('uses default values for promotedBy and reason', async () => {
      const override = await store.setOverride('@community/agent', 'verified')
      expect(override.promotedBy).toBe('user')
      expect(override.reason).toBe('Manually promoted via CLI')
    })
  })

  describe('removeOverride', () => {
    it('removes existing override and returns true', async () => {
      await store.setOverride('@community/agent', 'verified')
      const removed = await store.removeOverride('@community/agent')
      expect(removed).toBe(true)

      const override = await store.getOverride('@community/agent')
      expect(override).toBeUndefined()
    })

    it('returns false when override does not exist', async () => {
      const removed = await store.removeOverride('@community/nonexistent')
      expect(removed).toBe(false)
    })

    it('persists removal to disk', async () => {
      await store.setOverride('@community/agent', 'verified')
      await store.removeOverride('@community/agent')
      const raw = await readFile(join(tmpDir, 'config', 'trust-overrides.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed['@community/agent']).toBeUndefined()
    })
  })

  describe('getOverride', () => {
    it('returns override when present', async () => {
      await store.setOverride('@community/agent', 'verified', 'user', 'Checked')
      const override = await store.getOverride('@community/agent')
      expect(override).toBeDefined()
      expect(override?.trustTier).toBe('verified')
    })

    it('returns undefined when not present', async () => {
      const override = await store.getOverride('@community/missing')
      expect(override).toBeUndefined()
    })
  })

  describe('getOverridesMap', () => {
    it('returns flat agent-name → tier map', async () => {
      await store.setOverride('@community/a', 'verified')
      await store.setOverride('@community/b', 'community')
      const map = await store.getOverridesMap()
      expect(map).toEqual({
        '@community/a': 'verified',
        '@community/b': 'community',
      })
    })

    it('returns empty map when no overrides exist', async () => {
      const map = await store.getOverridesMap()
      expect(map).toEqual({})
    })
  })

  describe('error handling', () => {
    it('throws on corrupted JSON file', async () => {
      const {mkdir, writeFile} = await import('node:fs/promises')
      await mkdir(join(tmpDir, 'config'), {recursive: true})
      await writeFile(join(tmpDir, 'config', 'trust-overrides.json'), 'not json', 'utf-8')

      await expect(store.loadOverrides()).rejects.toThrow(TrustOverrideError)
      try {
        await store.loadOverrides()
      } catch (error) {
        expect((error as TrustOverrideError).code).toBe(TRUST_OVERRIDE_CORRUPTED)
      }
    })

    it('throws on schema-invalid JSON file', async () => {
      const {mkdir, writeFile} = await import('node:fs/promises')
      await mkdir(join(tmpDir, 'config'), {recursive: true})
      await writeFile(
        join(tmpDir, 'config', 'trust-overrides.json'),
        JSON.stringify({'agent': {trustTier: 'invalid-tier'}}),
        'utf-8',
      )

      await expect(store.loadOverrides()).rejects.toThrow(TrustOverrideError)
    })
  })
})
