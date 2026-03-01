import {describe, it, expect, vi, beforeEach} from 'vitest'

import {createSuccessMessage, createErrorMessage, createMockQuery} from '../../helpers/mock-agent-sdk.js'
import type {ComplianceReport} from '../../../src/lib/schemas/compliance-schema.js'
import type {ComplianceInputs} from '../../../src/lib/agents/quality.js'

import cleanFixture from '../../fixtures/outputs/compliance-report-clean.json'
import violationsFixture from '../../fixtures/outputs/compliance-report-violations.json'

const baseInputs: ComplianceInputs = {
  brandName: 'TestBrand',
  productDomain: 'skincare',
  contentText: 'Check out this amazing product!',
  platform: 'instagram',
  contentType: 'post',
  targetKeywords: ['skincare', 'serum'],
  callToAction: 'Shop now',
  isWellnessVertical: false,
}

const wellnessInputs: ComplianceInputs = {
  ...baseInputs,
  brandName: 'MindfulMe',
  productDomain: 'wellness',
  contentText: 'This meditation cures anxiety.',
  platform: 'tiktok',
  contentType: 'video-caption',
  targetKeywords: ['meditation', 'anxiety'],
  callToAction: 'Start your free trial',
  isWellnessVertical: true,
}

describe('runComplianceShield', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('returns valid ComplianceReport on success', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    const result = await runComplianceShield(baseInputs)

    expect(result.contentId).toBe('content-clean-001')
    expect(result.overallStatus).toBe('compliant')
    expect(result.complianceScore).toBe(98)
    expect(result.violations).toHaveLength(0)
    expect(result.rewrites).toHaveLength(0)
    expect(result.wellnessFlags).toHaveLength(0)
    expect(result.summary).toBeTruthy()
  })

  it('returns report with violations and rewrites', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(violationsFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    const result = await runComplianceShield(baseInputs)

    expect(result.overallStatus).toBe('violations-found')
    expect(result.violations).toHaveLength(2)
    expect(result.rewrites).toHaveLength(2)
    expect(result.violations[0].type).toBe('ftc-disclosure')
    expect(result.rewrites[0].preservedCta).toBe(true)
  })

  it('passes content text, platform, keywords, and CTA in the prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Check out this amazing product!')
    expect(callArgs.prompt).toContain('instagram')
    expect(callArgs.prompt).toContain('skincare, serum')
    expect(callArgs.prompt).toContain('Shop now')
    expect(callArgs.prompt).toContain('TestBrand')
  })

  it('includes wellness vertical instructions when isWellnessVertical is true', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(wellnessInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Wellness Vertical: Health Claim Detection')
    expect(callArgs.options.systemPrompt).toContain('FDA Boundary Rules')
    expect(callArgs.options.systemPrompt).toContain('Prohibited Claims')
  })

  it('omits wellness instructions when isWellnessVertical is false', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).not.toContain('Wellness Vertical: Health Claim Detection')
    expect(callArgs.options.systemPrompt).not.toContain('FDA Boundary Rules')
  })

  it('prompt indicates YES for wellness vertical when enabled', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(wellnessInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('YES — apply FDA health claim rules')
  })

  it('prompt indicates No for wellness vertical when disabled', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Wellness Vertical: No')
  })

  it('uses model "haiku" from skill definition', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {model: string}}
    expect(callArgs.options.model).toBe('haiku')
  })

  it('passes correct tools [Read] from skill definition', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {allowedTools: string[]}}
    expect(callArgs.options.allowedTools).toEqual(['Read'])
  })

  it('includes knowledge base in system prompt', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {options: {systemPrompt: string}}
    expect(callArgs.options.systemPrompt).toContain('Knowledge Base')
  })

  it('uses default contentId when not provided', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield(baseInputs)

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Content ID: content-001')
  })

  it('uses provided contentId when given', async () => {
    const mockQuery = createMockQuery([createSuccessMessage(cleanFixture)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    await runComplianceShield({...baseInputs, contentId: 'custom-id-123'})

    const callArgs = mockQuery.mock.calls[0][0] as {prompt: string}
    expect(callArgs.prompt).toContain('Content ID: custom-id-123')
  })

  it('throws AgentExecutionError on failure', async () => {
    const mockQuery = createMockQuery([createErrorMessage('error_during_execution')])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    const {AgentExecutionError} = await import('../../../src/lib/agent-executor/errors.js')

    await expect(runComplianceShield(baseInputs)).rejects.toThrow(AgentExecutionError)
  })

  it('throws AgentValidationError when agent returns invalid output', async () => {
    const invalidOutput = {contentId: 'x', violations: 'not-an-array'}
    const mockQuery = createMockQuery([createSuccessMessage(invalidOutput)])
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({query: mockQuery}))

    const {runComplianceShield} = await import('../../../src/lib/agents/quality.js')
    const {AgentValidationError} = await import('../../../src/lib/agents/errors.js')

    await expect(runComplianceShield(baseInputs)).rejects.toThrow(AgentValidationError)
  })
})
