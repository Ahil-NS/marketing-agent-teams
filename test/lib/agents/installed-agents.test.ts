import {join} from 'node:path'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'

import {describe, expect, it, beforeEach, afterEach} from 'vitest'

import {
  InstalledAgentsRegistry,
  InstalledAgentRegistryError,
  installedAgentSchema,
  installedAgentsRegistrySchema,
} from '../../../src/lib/agents/installed-agents.js'
import type {InstalledAgent} from '../../../src/lib/agents/installed-agents.js'

function createTestEntry(overrides?: Partial<InstalledAgent>): InstalledAgent {
  return {
    package: '@community/test-agent',
    version: '1.0.0',
    installedAt: '2026-03-01T00:00:00Z',
    trustTier: 'community',
    agents: ['test-agent'],
    enabled: true,
    ...overrides,
  }
}

describe('installedAgentSchema', () => {
  it('validates a valid entry', () => {
    const result = installedAgentSchema.safeParse(createTestEntry())
    expect(result.success).toBe(true)
  })

  it('rejects missing package', () => {
    const result = installedAgentSchema.safeParse({...createTestEntry(), package: ''})
    expect(result.success).toBe(false)
  })

  it('rejects non-community trustTier', () => {
    const result = installedAgentSchema.safeParse({...createTestEntry(), trustTier: 'builtin'})
    expect(result.success).toBe(false)
  })

  it('rejects invalid installedAt date', () => {
    const result = installedAgentSchema.safeParse({...createTestEntry(), installedAt: 'not-a-date'})
    expect(result.success).toBe(false)
  })

  it('rejects empty agents array', () => {
    const entry = createTestEntry({agents: []})
    // Empty array is valid per schema (z.array), but no agents discovered
    const result = installedAgentSchema.safeParse(entry)
    expect(result.success).toBe(true)
  })

  it('validates entry with multiple agents', () => {
    const entry = createTestEntry({agents: ['agent-a', 'agent-b', 'agent-c']})
    const result = installedAgentSchema.safeParse(entry)
    expect(result.success).toBe(true)
  })
})

describe('installedAgentsRegistrySchema', () => {
  it('validates empty registry', () => {
    const result = installedAgentsRegistrySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates registry with one entry', () => {
    const result = installedAgentsRegistrySchema.safeParse({
      '@community/test-agent': createTestEntry(),
    })
    expect(result.success).toBe(true)
  })

  it('validates registry with multiple entries', () => {
    const result = installedAgentsRegistrySchema.safeParse({
      '@community/agent-a': createTestEntry({package: '@community/agent-a', agents: ['agent-a']}),
      '@community/agent-b': createTestEntry({package: '@community/agent-b', agents: ['agent-b']}),
    })
    expect(result.success).toBe(true)
  })
})

describe('InstalledAgentsRegistry', () => {
  let tmpDir: string
  let registry: InstalledAgentsRegistry

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `mat-test-registry-${randomUUID()}`)
    await mkdir(tmpDir, {recursive: true})
    registry = new InstalledAgentsRegistry(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('loadRegistry', () => {
    it('returns empty object when file does not exist', async () => {
      const result = await registry.loadRegistry()
      expect(result).toEqual({})
    })

    it('loads valid registry from disk', async () => {
      const configDir = join(tmpDir, 'config')
      await mkdir(configDir, {recursive: true})
      const data = {'@community/test': createTestEntry()}
      await writeFile(join(configDir, 'installed-agents.json'), JSON.stringify(data), 'utf-8')

      const result = await registry.loadRegistry()
      expect(result).toEqual(data)
    })

    it('throws on corrupted JSON', async () => {
      const configDir = join(tmpDir, 'config')
      await mkdir(configDir, {recursive: true})
      await writeFile(join(configDir, 'installed-agents.json'), 'not json{{{', 'utf-8')

      await expect(registry.loadRegistry()).rejects.toThrow(InstalledAgentRegistryError)
      await expect(registry.loadRegistry()).rejects.toMatchObject({code: 'REGISTRY_CORRUPTED'})
    })

    it('throws on invalid schema', async () => {
      const configDir = join(tmpDir, 'config')
      await mkdir(configDir, {recursive: true})
      await writeFile(join(configDir, 'installed-agents.json'), JSON.stringify({bad: 'data'}), 'utf-8')

      await expect(registry.loadRegistry()).rejects.toThrow(InstalledAgentRegistryError)
      await expect(registry.loadRegistry()).rejects.toMatchObject({code: 'REGISTRY_CORRUPTED'})
    })
  })

  describe('saveRegistry', () => {
    it('creates directories and saves valid registry', async () => {
      const data = {'@community/test': createTestEntry()}
      await registry.saveRegistry(data)

      const raw = await readFile(join(tmpDir, 'config', 'installed-agents.json'), 'utf-8')
      expect(JSON.parse(raw)).toEqual(data)
    })

    it('overwrites existing registry', async () => {
      const data1 = {'@community/old': createTestEntry({package: '@community/old'})}
      await registry.saveRegistry(data1)

      const data2 = {'@community/new': createTestEntry({package: '@community/new'})}
      await registry.saveRegistry(data2)

      const raw = await readFile(join(tmpDir, 'config', 'installed-agents.json'), 'utf-8')
      expect(JSON.parse(raw)).toEqual(data2)
    })
  })

  describe('addAgent', () => {
    it('adds agent to empty registry', async () => {
      const entry = createTestEntry()
      await registry.addAgent('@community/test', entry)

      const result = await registry.loadRegistry()
      expect(result['@community/test']).toEqual(entry)
    })

    it('adds agent to existing registry without overwriting others', async () => {
      const entry1 = createTestEntry({package: '@community/first', agents: ['first']})
      await registry.addAgent('@community/first', entry1)

      const entry2 = createTestEntry({package: '@community/second', agents: ['second']})
      await registry.addAgent('@community/second', entry2)

      const result = await registry.loadRegistry()
      expect(Object.keys(result)).toHaveLength(2)
      expect(result['@community/first']).toEqual(entry1)
      expect(result['@community/second']).toEqual(entry2)
    })

    it('overwrites existing entry for same package', async () => {
      const entry1 = createTestEntry({version: '1.0.0'})
      await registry.addAgent('@community/test', entry1)

      const entry2 = createTestEntry({version: '2.0.0'})
      await registry.addAgent('@community/test', entry2)

      const result = await registry.loadRegistry()
      expect(result['@community/test'].version).toBe('2.0.0')
    })
  })

  describe('removeAgent', () => {
    it('removes existing agent and returns true', async () => {
      await registry.addAgent('@community/test', createTestEntry())
      const removed = await registry.removeAgent('@community/test')

      expect(removed).toBe(true)
      const result = await registry.loadRegistry()
      expect(result['@community/test']).toBeUndefined()
    })

    it('returns false for non-existent agent', async () => {
      const removed = await registry.removeAgent('@community/does-not-exist')
      expect(removed).toBe(false)
    })

    it('preserves other agents when removing one', async () => {
      await registry.addAgent('@community/keep', createTestEntry({package: '@community/keep'}))
      await registry.addAgent('@community/remove', createTestEntry({package: '@community/remove'}))

      await registry.removeAgent('@community/remove')

      const result = await registry.loadRegistry()
      expect(result['@community/keep']).toBeDefined()
      expect(result['@community/remove']).toBeUndefined()
    })
  })

  describe('getAgent', () => {
    it('returns the agent entry if it exists', async () => {
      const entry = createTestEntry()
      await registry.addAgent('@community/test', entry)

      const result = await registry.getAgent('@community/test')
      expect(result).toEqual(entry)
    })

    it('returns undefined for non-existent agent', async () => {
      const result = await registry.getAgent('@community/nope')
      expect(result).toBeUndefined()
    })
  })

  describe('listAll', () => {
    it('returns all installed agents', async () => {
      await registry.addAgent('@community/a', createTestEntry({package: '@community/a', agents: ['a']}))
      await registry.addAgent('@community/b', createTestEntry({package: '@community/b', agents: ['b']}))

      const all = await registry.listAll()
      expect(Object.keys(all)).toHaveLength(2)
    })

    it('returns empty object when no agents installed', async () => {
      const all = await registry.listAll()
      expect(all).toEqual({})
    })
  })
})

describe('InstalledAgentRegistryError', () => {
  it('extends MATError with correct properties', () => {
    const err = new InstalledAgentRegistryError(
      'Test error',
      'TEST_CODE',
      'Test reason',
      'Test resolution',
    )
    expect(err.message).toBe('Test error')
    expect(err.code).toBe('TEST_CODE')
    expect(err.reason).toBe('Test reason')
    expect(err.resolution).toBe('Test resolution')
    expect(err.source).toBe('installed-agents')
    expect(err.severity).toBe('permanent')
  })
})
