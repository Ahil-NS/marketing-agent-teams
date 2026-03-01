import {describe, it, expect, vi, beforeEach} from 'vitest'

describe('clearAgentMemory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('removes state file and returns entry count', async () => {
    const mockClear = vi.fn().mockResolvedValue(undefined)

    vi.doMock('../../../src/lib/agents/memory-store.js', () => ({
      AgentMemoryStore: class {
        load = vi.fn().mockResolvedValue({
          agentName: 'trend-scout',
          lastRunId: 'run-1',
          lastRunAt: '2026-03-01T10:00:00.000Z',
          entries: [
            {id: '1', runId: 'run-1', timestamp: '2026-03-01T10:00:00.000Z', type: 'rejection', content: '{}', source: 'review-queue', confidence: 1.0},
            {id: '2', runId: 'run-2', timestamp: '2026-03-01T11:00:00.000Z', type: 'learning', content: 'some learning', source: 'agent-self', confidence: 0.8},
          ],
          metadata: {},
        })
        clear = mockClear
      },
    }))

    const {clearAgentMemory} = await import('../../../src/lib/agents/memory-clearer.js')
    const result = await clearAgentMemory('trend-scout', '.mat')

    expect(result.cleared).toBe(true)
    expect(result.entriesRemoved).toBe(2)
    expect(mockClear).toHaveBeenCalledWith('trend-scout')
  })

  it('handles non-existent state file gracefully', async () => {
    const mockClear = vi.fn().mockResolvedValue(undefined)

    vi.doMock('../../../src/lib/agents/memory-store.js', () => ({
      AgentMemoryStore: class {
        load = vi.fn().mockResolvedValue({
          agentName: 'no-memory-agent',
          lastRunId: null,
          lastRunAt: null,
          entries: [],
          metadata: {},
        })
        clear = mockClear
      },
    }))

    const {clearAgentMemory} = await import('../../../src/lib/agents/memory-clearer.js')
    const result = await clearAgentMemory('no-memory-agent', '.mat')

    expect(result.cleared).toBe(false)
    expect(result.entriesRemoved).toBe(0)
    expect(mockClear).not.toHaveBeenCalled()
  })
})

describe('clearAllAgentMemory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('clears all agent directories', async () => {
    vi.doMock('node:fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue(['trend-scout', 'competitor-analyst']),
    }))

    let callCount = 0
    vi.doMock('../../../src/lib/agents/memory-store.js', () => ({
      AgentMemoryStore: class {
        load = vi.fn().mockImplementation(() => {
          callCount++
          const agentName = callCount === 1 ? 'trend-scout' : 'competitor-analyst'
          return Promise.resolve({
            agentName,
            lastRunId: 'run-1',
            lastRunAt: '2026-03-01T10:00:00.000Z',
            entries: [
              {id: '1', runId: 'run-1', timestamp: '2026-03-01T10:00:00.000Z', type: 'rejection' as const, content: '{}', source: 'review-queue', confidence: 1.0},
            ],
            metadata: {},
          })
        })
        clear = vi.fn().mockResolvedValue(undefined)
      },
    }))

    const {clearAllAgentMemory} = await import('../../../src/lib/agents/memory-clearer.js')
    const result = await clearAllAgentMemory('.mat')

    expect(result.agentsCleared).toContain('trend-scout')
    expect(result.agentsCleared).toContain('competitor-analyst')
    expect(result.totalEntriesRemoved).toBe(2)
  })

  it('returns summary with agent names and total entries', async () => {
    vi.doMock('node:fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue(['trend-scout']),
    }))

    vi.doMock('../../../src/lib/agents/memory-store.js', () => ({
      AgentMemoryStore: class {
        load = vi.fn().mockResolvedValue({
          agentName: 'trend-scout',
          lastRunId: 'run-1',
          lastRunAt: '2026-03-01T10:00:00.000Z',
          entries: [
            {id: '1', runId: 'run-1', timestamp: '2026-03-01T10:00:00.000Z', type: 'rejection' as const, content: '{}', source: 'review-queue', confidence: 1.0},
            {id: '2', runId: 'run-2', timestamp: '2026-03-01T11:00:00.000Z', type: 'rejection' as const, content: '{}', source: 'review-queue', confidence: 1.0},
            {id: '3', runId: 'run-3', timestamp: '2026-03-01T12:00:00.000Z', type: 'learning' as const, content: 'x', source: 'agent-self', confidence: 0.5},
          ],
          metadata: {},
        })
        clear = vi.fn().mockResolvedValue(undefined)
      },
    }))

    const {clearAllAgentMemory} = await import('../../../src/lib/agents/memory-clearer.js')
    const result = await clearAllAgentMemory('.mat')

    expect(result.agentsCleared).toEqual(['trend-scout'])
    expect(result.totalEntriesRemoved).toBe(3)
  })

  it('handles non-existent agents directory gracefully', async () => {
    vi.doMock('node:fs/promises', () => ({
      readdir: vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory')),
    }))

    vi.doMock('../../../src/lib/agents/memory-store.js', () => ({
      AgentMemoryStore: class {
        load = vi.fn()
        clear = vi.fn()
      },
    }))

    const {clearAllAgentMemory} = await import('../../../src/lib/agents/memory-clearer.js')
    const result = await clearAllAgentMemory('.mat')

    expect(result.agentsCleared).toEqual([])
    expect(result.totalEntriesRemoved).toBe(0)
  })
})
