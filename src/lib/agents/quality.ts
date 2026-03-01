import {join} from 'node:path'

import {brandGuardianOutputSchema} from '../schemas/quality-schema.js'
import type {BrandGuardianOutput} from '../schemas/quality-schema.js'
import type {BrandVoiceConfig} from '../schemas/config-schema.js'

import {executeAgent} from './agent-executor.js'
import {AgentMemoryStore} from './memory-store.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'

export interface BrandGuardianInputs {
  contentItems: Array<{id: string; platform: string; content: string}>
  brandVoiceConfig: BrandVoiceConfig
  qualityThreshold: number
}

export interface QualityGateDecision {
  passed: string[]
  blocked: string[]
  blockReasons: Record<string, string[]>
}

const DEFAULT_QUALITY_THRESHOLD = 70

/**
 * Run the Brand Voice Guardian agent.
 * Evaluates content items against brand voice configuration and assigns
 * quality scores (0-100) with sub-score breakdowns. Supports learned
 * edit pattern injection from memory store (FR61).
 *
 * Uses model: sonnet — complex brand evaluation requires stronger model.
 */
export async function runBrandGuardian(
  inputs: BrandGuardianInputs,
  memoryStore?: AgentMemoryStore,
): Promise<BrandGuardianOutput> {
  const skill = await loadSkill(join(agentsRoot(), 'quality', 'brand-guardian'))

  // Load memory context for learned edit patterns (FR61)
  let memoryContext = ''
  if (memoryStore) {
    memoryContext = await memoryStore.getContextForPrompt('brand-guardian')
  }

  const systemPromptParts = [
    skill.systemPrompt,
    '\n\n## Knowledge Base\n\n',
    skill.knowledgeContext,
  ]

  if (memoryContext) {
    systemPromptParts.push('\n\n', memoryContext)
  }

  const result = await executeAgent<BrandGuardianOutput>('brand-guardian', {
    prompt: `Evaluate the following content items against the brand voice configuration.

## Brand Voice Configuration
Tone: ${inputs.brandVoiceConfig.tone}
Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ') || 'None specified'}
Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ') || 'None specified'}

## Quality Threshold
Items scoring below ${inputs.qualityThreshold} will be blocked from the review queue.

## Content Items

${JSON.stringify(inputs.contentItems, null, 2)}

## Instructions
- Score each content item on a 0-100 scale
- Provide sub-scores: toneAlignment, styleConsistency, principleAdherence
- Flag any banned phrase violations
- List specific issues with severity (low/medium/high)
- Provide actionable suggestions for each issue
- Determine quality gate pass/block for each item
- Identify any reusable edit patterns for future reference
- Produce structured JSON output matching the schema`,
    systemPrompt: systemPromptParts.join(''),
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: brandGuardianOutputSchema,
  })

  return result.outputs
}

/**
 * Apply quality gate logic to Brand Guardian output.
 * Items scoring at or above the threshold pass; items below are blocked.
 */
export function applyQualityGate(
  output: BrandGuardianOutput,
  qualityThreshold: number = DEFAULT_QUALITY_THRESHOLD,
): QualityGateDecision {
  const passed: string[] = []
  const blocked: string[] = []
  const blockReasons: Record<string, string[]> = {}

  for (const gateResult of output.qualityGateResults) {
    if (gateResult.qualityScore >= qualityThreshold) {
      passed.push(gateResult.contentItemId)
    } else {
      blocked.push(gateResult.contentItemId)
      blockReasons[gateResult.contentItemId] = gateResult.blockedReasons.length > 0
        ? gateResult.blockedReasons
        : [`Quality score ${gateResult.qualityScore} is below threshold ${qualityThreshold}`]
    }
  }

  return {passed, blocked, blockReasons}
}

/**
 * Persist learned edit patterns from Brand Guardian output to agent memory.
 * Uses AgentMemoryStore to store patterns for future prompt injection (FR61).
 */
export async function persistLearnedPatterns(
  output: BrandGuardianOutput,
  runId: string,
  memoryStore: AgentMemoryStore,
): Promise<void> {
  for (const pattern of output.learnedPatterns) {
    await memoryStore.addEntry('brand-guardian', {
      runId,
      type: 'pattern',
      content: `[${pattern.patternType}] ${pattern.pattern}`,
      source: 'quality-gate',
      confidence: pattern.confidence,
    })
  }
}
