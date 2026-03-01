import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {
  TrustOverrideStore,
  TrustOverrideError,
} from '../../../src/lib/credentials/trust-overrides.js'

// Mock InstalledAgentsRegistry
const mockRegistry = {
  loadRegistry: vi.fn().mockResolvedValue({}),
}

vi.mock('../../../src/lib/agents/installed-agents.js', () => ({
  InstalledAgentsRegistry: vi.fn().mockImplementation(() => mockRegistry),
}))

describe('AgentsTrust command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have required agent arg and optional tier arg', async () => {
    const {default: AgentsTrustCommand} = await import('../../../src/commands/agents/trust.js')
    expect(AgentsTrustCommand.args).toHaveProperty('agent')
    expect(AgentsTrustCommand.args.agent).toMatchObject({required: true})
    expect(AgentsTrustCommand.args).toHaveProperty('tier')
    expect(AgentsTrustCommand.args.tier).toMatchObject({required: false})
  })

  it('should have --revoke and --reason flags', async () => {
    const {default: AgentsTrustCommand} = await import('../../../src/commands/agents/trust.js')
    expect(AgentsTrustCommand.flags).toHaveProperty('revoke')
    expect(AgentsTrustCommand.flags).toHaveProperty('reason')
  })

  it('should have description containing trust tier', async () => {
    const {default: AgentsTrustCommand} = await import('../../../src/commands/agents/trust.js')
    expect(AgentsTrustCommand.description).toBeDefined()
    expect(AgentsTrustCommand.description!.toLowerCase()).toMatch(/trust|tier/)
  })

  it('should have examples defined', async () => {
    const {default: AgentsTrustCommand} = await import('../../../src/commands/agents/trust.js')
    expect(AgentsTrustCommand.examples).toBeDefined()
    expect(AgentsTrustCommand.examples!.length).toBeGreaterThan(0)
  })
})

describe('TrustOverrideStore integration for CLI', () => {
  let tmpDir: string
  let store: TrustOverrideStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-trust-cmd-'))
    store = new TrustOverrideStore(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  it('promotes community agent to verified', async () => {
    const override = await store.setOverride(
      '@community/linkedin-agent',
      'verified',
      'user',
      'Code reviewed and approved',
    )
    expect(override.trustTier).toBe('verified')
    expect(override.promotedBy).toBe('user')
    expect(override.reason).toBe('Code reviewed and approved')
  })

  it('revokes trust override and removes from file', async () => {
    await store.setOverride('@community/linkedin-agent', 'verified')
    const removed = await store.removeOverride('@community/linkedin-agent')
    expect(removed).toBe(true)

    const override = await store.getOverride('@community/linkedin-agent')
    expect(override).toBeUndefined()
  })

  it('revoke returns false for non-existent override', async () => {
    const removed = await store.removeOverride('@community/nonexistent')
    expect(removed).toBe(false)
  })

  it('blocks promotion to builtin tier', async () => {
    await expect(
      store.setOverride('@community/agent', 'builtin'),
    ).rejects.toThrow(TrustOverrideError)
  })

  it('blocks modification of builtin agents', async () => {
    await expect(
      store.setOverride('trend-scout', 'verified', 'user', 'test', true),
    ).rejects.toThrow(TrustOverrideError)
  })

  it('getOverridesMap returns flat tier map for getEffectiveTrustTier()', async () => {
    await store.setOverride('@community/a', 'verified')
    await store.setOverride('@community/b', 'community')
    const map = await store.getOverridesMap()
    expect(map).toEqual({
      '@community/a': 'verified',
      '@community/b': 'community',
    })
  })
})
