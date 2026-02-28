import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {MemoryCorruptionError, MemoryStoreError} from '../../../src/lib/agents/errors.js'
import {AgentMemoryStore} from '../../../src/lib/agents/memory-store.js'
import {createTestDir, removeTestDir} from '../../helpers/test-project.js'

describe('AgentMemoryStore', () => {
  let tempDir: string
  let store: AgentMemoryStore

  beforeEach(async () => {
    tempDir = await createTestDir()
    store = new AgentMemoryStore(tempDir)
  })

  afterEach(async () => {
    await removeTestDir(tempDir)
  })

  describe('load()', () => {
    it('returns empty state when no file exists', async () => {
      const state = await store.load('trend-scout')
      expect(state.agentName).toBe('trend-scout')
      expect(state.entries).toEqual([])
      expect(state.lastRunId).toBeNull()
      expect(state.lastRunAt).toBeNull()
      expect(state.metadata).toEqual({})
    })

    it('loads valid state from existing file', async () => {
      const validState = {
        agentName: 'trend-scout',
        lastRunId: 'run-001',
        lastRunAt: '2026-02-28T10:00:00.000Z',
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            runId: 'run-001',
            timestamp: '2026-02-28T10:00:00.000Z',
            type: 'learning',
            content: 'Test learning',
            source: 'agent-self',
            confidence: 0.85,
          },
        ],
        metadata: {totalRunCount: 1},
      }

      const stateDir = join(tempDir, 'agents', 'trend-scout')
      await mkdir(stateDir, {recursive: true})
      await writeFile(join(stateDir, 'state.json'), JSON.stringify(validState), 'utf-8')

      const state = await store.load('trend-scout')
      expect(state.agentName).toBe('trend-scout')
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0].content).toBe('Test learning')
      expect(state.lastRunId).toBe('run-001')
      expect(state.metadata).toEqual({totalRunCount: 1})
    })

    it('throws MemoryCorruptionError for invalid JSON', async () => {
      const stateDir = join(tempDir, 'agents', 'trend-scout')
      await mkdir(stateDir, {recursive: true})
      await writeFile(join(stateDir, 'state.json'), '{invalid json!!!', 'utf-8')

      await expect(store.load('trend-scout')).rejects.toThrow(MemoryCorruptionError)
    })

    it('throws MemoryCorruptionError for invalid schema', async () => {
      const invalidState = {
        agentName: 'trend-scout',
        lastRunId: null,
        lastRunAt: null,
        entries: [
          {
            // missing required fields
            id: 'not-a-uuid',
            type: 'invalid-type',
          },
        ],
        metadata: {},
      }

      const stateDir = join(tempDir, 'agents', 'trend-scout')
      await mkdir(stateDir, {recursive: true})
      await writeFile(join(stateDir, 'state.json'), JSON.stringify(invalidState), 'utf-8')

      await expect(store.load('trend-scout')).rejects.toThrow(MemoryCorruptionError)
    })

    it('MemoryCorruptionError has correct error code', async () => {
      const stateDir = join(tempDir, 'agents', 'trend-scout')
      await mkdir(stateDir, {recursive: true})
      await writeFile(join(stateDir, 'state.json'), 'corrupted', 'utf-8')

      try {
        await store.load('trend-scout')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(MemoryCorruptionError)
        expect((error as MemoryCorruptionError).code).toBe('MEMORY_STATE_CORRUPTED')
        expect((error as MemoryCorruptionError).severity).toBe('permanent')
      }
    })
  })

  describe('save()', () => {
    it('creates directories if needed', async () => {
      const state = {
        agentName: 'new-agent',
        lastRunId: null,
        lastRunAt: null,
        entries: [],
        metadata: {},
      }

      await store.save(state)

      // Verify by loading it back
      const loaded = await store.load('new-agent')
      expect(loaded.agentName).toBe('new-agent')
    })

    it('writes valid JSON', async () => {
      const state = {
        agentName: 'test-agent',
        lastRunId: 'run-001',
        lastRunAt: '2026-02-28T10:00:00.000Z',
        entries: [],
        metadata: {key: 'value'},
      }

      await store.save(state)
      const loaded = await store.load('test-agent')
      expect(loaded.lastRunId).toBe('run-001')
      expect(loaded.metadata).toEqual({key: 'value'})
    })

    it('overwrites existing state file', async () => {
      const state1 = {
        agentName: 'test-agent',
        lastRunId: 'run-001',
        lastRunAt: '2026-02-28T10:00:00.000Z',
        entries: [],
        metadata: {},
      }

      await store.save(state1)

      const state2 = {
        ...state1,
        lastRunId: 'run-002',
        lastRunAt: '2026-02-28T11:00:00.000Z',
      }

      await store.save(state2)

      const loaded = await store.load('test-agent')
      expect(loaded.lastRunId).toBe('run-002')
    })
  })

  describe('addEntry()', () => {
    it('appends entry with auto-generated id and timestamp', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Test learning',
        source: 'agent-self',
        confidence: 0.8,
      })
      const state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0].id).toBeDefined()
      expect(state.entries[0].id).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/)
      expect(state.entries[0].timestamp).toBeDefined()
      expect(state.entries[0].content).toBe('Test learning')
      expect(state.entries[0].type).toBe('learning')
    })

    it('enforces maxEntries via FIFO eviction', async () => {
      for (let i = 0; i < 5; i++) {
        await store.addEntry(
          'trend-scout',
          {
            runId: `run-${i}`,
            type: 'learning',
            content: `Learning ${i}`,
            source: 'agent-self',
            confidence: 0.5,
          },
          {maxEntries: 3},
        )
      }

      const state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(3)
      // Oldest entries (0, 1) should have been evicted — entries 2, 3, 4 remain
      expect(state.entries[0].content).toBe('Learning 2')
      expect(state.entries[1].content).toBe('Learning 3')
      expect(state.entries[2].content).toBe('Learning 4')
    })

    it('does nothing when memoryEnabled is false', async () => {
      await store.addEntry(
        'trend-scout',
        {
          runId: 'run-001',
          type: 'learning',
          content: 'Should not be saved',
          source: 'test',
          confidence: 0.5,
        },
        {memoryEnabled: false},
      )
      const state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(0)
    })

    it('preserves existing entries when adding new ones', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'First',
        source: 'agent-self',
        confidence: 0.8,
      })

      await store.addEntry('trend-scout', {
        runId: 'run-002',
        type: 'rejection',
        content: 'Second',
        source: 'human-review',
        confidence: 1.0,
      })

      const state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(2)
      expect(state.entries[0].content).toBe('First')
      expect(state.entries[1].content).toBe('Second')
    })
  })

  describe('getContextForPrompt()', () => {
    it('returns empty string when no memory exists', async () => {
      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toBe('')
    })

    it('returns formatted context with learning entries', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Reddit wellness peaks on Tuesdays',
        source: 'agent-self',
        confidence: 0.78,
      })

      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toContain('## Historical Context (from previous runs)')
      expect(context).toContain('### Learned Insights')
      expect(context).toContain('Reddit wellness peaks on Tuesdays')
      expect(context).toContain('confidence: 0.78')
      expect(context).toContain('source: agent-self')
    })

    it('returns formatted context with rejection entries', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'rejection',
        content: 'Crypto angle rejected as off-brand',
        source: 'human-review',
        confidence: 1.0,
      })

      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toContain('### Rejected Approaches (avoid these)')
      expect(context).toContain('Crypto angle rejected as off-brand')
    })

    it('returns formatted context with pattern entries', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'pattern',
        content: 'Morning routine hooks get 2x engagement',
        source: 'agent-self',
        confidence: 0.82,
      })

      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toContain('### Observed Patterns')
      expect(context).toContain('Morning routine hooks get 2x engagement')
    })

    it('returns formatted context with preference entries', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'preference',
        content: 'User prefers concise outputs',
        source: 'human-review',
        confidence: 0.9,
      })

      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toContain('### User Preferences')
      expect(context).toContain('User prefers concise outputs')
    })

    it('formats all entry types correctly when mixed', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Learning 1',
        source: 'agent-self',
        confidence: 0.8,
      })

      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'rejection',
        content: 'Rejection 1',
        source: 'human-review',
        confidence: 1.0,
      })

      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'pattern',
        content: 'Pattern 1',
        source: 'agent-self',
        confidence: 0.7,
      })

      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'preference',
        content: 'Preference 1',
        source: 'human-review',
        confidence: 0.9,
      })

      const context = await store.getContextForPrompt('trend-scout')
      expect(context).toContain('### Learned Insights')
      expect(context).toContain('### Rejected Approaches (avoid these)')
      expect(context).toContain('### Observed Patterns')
      expect(context).toContain('### User Preferences')
    })
  })

  describe('prune()', () => {
    it('removes entries older than retentionDays', async () => {
      // Manually create state with old entries
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 100) // 100 days ago

      const state = {
        agentName: 'trend-scout',
        lastRunId: 'run-001',
        lastRunAt: '2026-02-28T10:00:00.000Z',
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            runId: 'run-001',
            timestamp: oldDate.toISOString(),
            type: 'learning' as const,
            content: 'Old learning',
            source: 'agent-self',
            confidence: 0.8,
          },
          {
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            runId: 'run-002',
            timestamp: new Date().toISOString(),
            type: 'learning' as const,
            content: 'Recent learning',
            source: 'agent-self',
            confidence: 0.9,
          },
        ],
        metadata: {},
      }

      await store.save(state)

      const pruned = await store.prune('trend-scout', {retentionDays: 90})
      expect(pruned).toBe(1)

      const loaded = await store.load('trend-scout')
      expect(loaded.entries).toHaveLength(1)
      expect(loaded.entries[0].content).toBe('Recent learning')
    })

    it('returns 0 when no entries need pruning', async () => {
      const pruned = await store.prune('trend-scout')
      expect(pruned).toBe(0)
    })

    it('returns 0 when all entries are within retention window', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Recent learning',
        source: 'agent-self',
        confidence: 0.8,
      })

      const pruned = await store.prune('trend-scout', {retentionDays: 90})
      expect(pruned).toBe(0)
    })

    it('does not save when nothing pruned', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Recent',
        source: 'test',
        confidence: 0.5,
      })

      const pruned = await store.prune('trend-scout', {retentionDays: 90})
      expect(pruned).toBe(0)
    })
  })

  describe('clear()', () => {
    it('removes state file', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'Will be cleared',
        source: 'test',
        confidence: 0.5,
      })

      // Verify entry exists
      let state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(1)

      await store.clear('trend-scout')

      // Should return empty state now
      state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(0)
    })

    it('is idempotent — no error when file missing', async () => {
      await expect(store.clear('nonexistent-agent')).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('MemoryStoreError has correct properties', async () => {
      const error = new MemoryStoreError(
        'Test error',
        'MEMORY_STORE_WRITE_FAILED',
        'Test reason',
        'Test resolution',
        'memory-store',
        'transient',
      )
      expect(error.code).toBe('MEMORY_STORE_WRITE_FAILED')
      expect(error.reason).toBe('Test reason')
      expect(error.resolution).toBe('Test resolution')
      expect(error.source).toBe('memory-store')
      expect(error.severity).toBe('transient')
    })

    it('MemoryCorruptionError has correct properties', async () => {
      const error = new MemoryCorruptionError(
        'Test corruption',
        'MEMORY_STATE_CORRUPTED',
        'Test reason',
        'Test resolution',
        'memory-store',
        'permanent',
      )
      expect(error.code).toBe('MEMORY_STATE_CORRUPTED')
      expect(error.severity).toBe('permanent')
    })
  })

  describe('agentName validation', () => {
    it('rejects agentName with path traversal (../)', async () => {
      await expect(store.load('../../etc')).rejects.toThrow(MemoryStoreError)
      await expect(store.load('../passwd')).rejects.toThrow(MemoryStoreError)
    })

    it('rejects agentName with forward slashes', async () => {
      await expect(store.load('cluster/agent')).rejects.toThrow(MemoryStoreError)
    })

    it('rejects agentName with spaces', async () => {
      await expect(store.load('my agent')).rejects.toThrow(MemoryStoreError)
    })

    it('rejects agentName with dots', async () => {
      await expect(store.load('agent.v2')).rejects.toThrow(MemoryStoreError)
    })

    it('rejects empty agentName', async () => {
      await expect(store.load('')).rejects.toThrow(MemoryStoreError)
    })

    it('accepts valid kebab-case agentName', async () => {
      const state = await store.load('trend-scout')
      expect(state.agentName).toBe('trend-scout')
    })

    it('accepts single-word agentName', async () => {
      const state = await store.load('agent')
      expect(state.agentName).toBe('agent')
    })

    it('validation error has correct error code', async () => {
      try {
        await store.load('../../etc')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(MemoryStoreError)
        expect((error as MemoryStoreError).code).toBe('MEMORY_STORE_INVALID_AGENT')
        expect((error as MemoryStoreError).severity).toBe('permanent')
      }
    })
  })

  describe('lastRunId / lastRunAt tracking', () => {
    it('updates lastRunId and lastRunAt after addEntry', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-abc',
        type: 'learning',
        content: 'Test',
        source: 'agent-self',
        confidence: 0.8,
      })

      const state = await store.load('trend-scout')
      expect(state.lastRunId).toBe('run-abc')
      expect(state.lastRunAt).toBeDefined()
      expect(state.lastRunAt).not.toBeNull()
    })

    it('updates lastRunId to most recent entry', async () => {
      await store.addEntry('trend-scout', {
        runId: 'run-001',
        type: 'learning',
        content: 'First',
        source: 'agent-self',
        confidence: 0.8,
      })

      await store.addEntry('trend-scout', {
        runId: 'run-002',
        type: 'pattern',
        content: 'Second',
        source: 'agent-self',
        confidence: 0.7,
      })

      const state = await store.load('trend-scout')
      expect(state.lastRunId).toBe('run-002')
    })
  })

  describe('concurrent writes', () => {
    it('does not lose entries with concurrent addEntry calls', async () => {
      const promises = Array.from({length: 5}, (_, i) =>
        store.addEntry('trend-scout', {
          runId: `run-${i}`,
          type: 'learning',
          content: `Concurrent entry ${i}`,
          source: 'agent-self',
          confidence: 0.5,
        }),
      )

      await Promise.all(promises)

      const state = await store.load('trend-scout')
      expect(state.entries).toHaveLength(5)
    })
  })
})
