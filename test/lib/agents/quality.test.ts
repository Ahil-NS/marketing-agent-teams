import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {BrandGuardianOutput} from '../../../src/lib/schemas/quality-schema.js'
import type {BrandGuardianInputs} from '../../../src/lib/agents/quality.js'

import fixture from '../../fixtures/responses/claude-brand-guardian.json'

const testInputs: BrandGuardianInputs = {
  contentItems: [
    {id: 'content-1', platform: 'reddit', content: 'Test content about wellness'},
    {id: 'content-2', platform: 'instagram', content: 'Guaranteed best in class results for you!'},
  ],
  brandVoiceConfig: {
    tone: 'professional',
    communicationStyle: 'clear and direct',
    brandPrinciples: ['transparency', 'helpfulness'],
    bannedPhrases: ['guaranteed', 'best in class'],
    qualityThreshold: 70,
  },
  qualityThreshold: 70,
}

describe('runBrandGuardian', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid BrandGuardianOutput on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const result = await runBrandGuardian(testInputs)

    expect(result.reviews).toHaveLength(2)
    expect(result.reviews[0].qualityScore).toBe(85)
    expect(result.reviews[1].qualityScore).toBe(45)
    expect(result.overallAssessment.totalReviewed).toBe(2)
    expect(result.overallAssessment.totalPassed).toBe(1)
    expect(result.overallAssessment.totalBlocked).toBe(1)
  })

  it('scores each content item (0-100)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const result = await runBrandGuardian(testInputs)

    for (const review of result.reviews) {
      expect(review.qualityScore).toBeGreaterThanOrEqual(0)
      expect(review.qualityScore).toBeLessThanOrEqual(100)
      expect(review.toneAlignment).toBeGreaterThanOrEqual(0)
      expect(review.toneAlignment).toBeLessThanOrEqual(100)
      expect(review.styleConsistency).toBeGreaterThanOrEqual(0)
      expect(review.styleConsistency).toBeLessThanOrEqual(100)
      expect(review.principleAdherence).toBeGreaterThanOrEqual(0)
      expect(review.principleAdherence).toBeLessThanOrEqual(100)
    }
  })

  it('injects brand voice config into prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    await runBrandGuardian(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('professional')
    expect(callArgs.prompt).toContain('clear and direct')
    expect(callArgs.prompt).toContain('transparency')
    expect(callArgs.prompt).toContain('guaranteed')
  })

  it('loads memory context via getContextForPrompt()', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const {AgentMemoryStore} = await import('../../../src/lib/agents/memory-store.js')

    const mockMemoryStore = {
      getContextForPrompt: vi.fn().mockResolvedValue('## Historical Context\n\n### Observed Patterns\n- Prefer casual tone'),
      addEntry: vi.fn(),
    } as unknown as InstanceType<typeof AgentMemoryStore>

    await runBrandGuardian(testInputs, mockMemoryStore)

    expect(mockMemoryStore.getContextForPrompt).toHaveBeenCalledWith('brand-guardian')
  })

  it('appends memory context to system prompt when entries exist', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const {AgentMemoryStore} = await import('../../../src/lib/agents/memory-store.js')

    const mockMemoryStore = {
      getContextForPrompt: vi.fn().mockResolvedValue('## Historical Context\n\n### Observed Patterns\n- Prefer casual tone'),
      addEntry: vi.fn(),
    } as unknown as InstanceType<typeof AgentMemoryStore>

    await runBrandGuardian(testInputs, mockMemoryStore)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Historical Context')
    expect(callArgs.options.systemPrompt).toContain('Observed Patterns')
  })

  it('works without memory context (empty string)', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const {AgentMemoryStore} = await import('../../../src/lib/agents/memory-store.js')

    const mockMemoryStore = {
      getContextForPrompt: vi.fn().mockResolvedValue(''),
      addEntry: vi.fn(),
    } as unknown as InstanceType<typeof AgentMemoryStore>

    const result = await runBrandGuardian(testInputs, mockMemoryStore)

    expect(result.reviews).toHaveLength(2)
    // Empty memory context should not be appended — count occurrences of the memory injected header
    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    // The SKILL.md may reference "Historical Context" in its instructions, but
    // the memory-injected section starts with "## Historical Context (from previous runs)"
    expect(callArgs.options.systemPrompt).not.toContain('## Historical Context (from previous runs)')
  })

  it('works without memory store parameter', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const result = await runBrandGuardian(testInputs)

    expect(result.reviews).toHaveLength(2)
  })

  it('throws AgentExecutionError on failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runBrandGuardian(testInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError on invalid output', async () => {
    const invalidOutput = {reviews: 'not-an-array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runBrandGuardian(testInputs)).rejects.toThrow(AgentValidationError)
  })

  it('passes correct tools [Read, Glob] to executeAgent()', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    await runBrandGuardian(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(
      expect.arrayContaining(['Read', 'Glob']),
    )
  })

  it('uses model "sonnet" from skill definition', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    await runBrandGuardian(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('sonnet')
  })

  it('includes quality threshold in prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    await runBrandGuardian({...testInputs, qualityThreshold: 85})

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('85')
  })

  it('includes knowledge base in system prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(fixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runBrandGuardian} = await import('../../../src/lib/agents/quality.js')
    await runBrandGuardian(testInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })
})
