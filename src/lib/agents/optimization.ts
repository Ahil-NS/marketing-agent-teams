import {join} from 'node:path'

import {seoOptimizationOutputSchema} from '../schemas/seo-schema.js'
import type {SeoOptimizationOutput, SeoContentItem, PlatformSeoConfig} from '../schemas/seo-schema.js'
import {humanizationOutputSchema} from '../schemas/humanization-schema.js'
import type {HumanizationOutput} from '../schemas/humanization-schema.js'
import {abTestOutputSchema} from '../schemas/optimization-schema.js'
import type {AbTestOutput, AbTestInputs, ContentVariation} from '../schemas/optimization-schema.js'
import {z} from 'zod'
import {hashtagStrategyOutputSchema} from '../schemas/hashtag-schema.js'
import type {HashtagStrategyOutput} from '../schemas/hashtag-schema.js'

import {executeAgent} from './agent-executor.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'
import {getPlatformSeoConfig} from './seo-config.js'
import {PLATFORM_HASHTAG_LIMITS} from './hashtag-config.js'
import type {AgentResult} from './types.js'

export interface SeoOptimizationInputs {
  contentItems: SeoContentItem[]
  platforms: string[]
  brandKeywords: string[]
  campaignKeywords?: string[]
}

/**
 * Run the SEO Optimization agent.
 * Applies platform-specific SEO rules to content items — keyword density,
 * hashtag counts, alt-text, ranking signals, and TikTok 4-layer optimization.
 *
 * Loads SKILL.md definition, constructs prompt with platform SEO configs,
 * executes via Agent SDK, and validates output against seoOptimizationOutputSchema.
 */
export async function runSeoOptimizer(
  inputs: SeoOptimizationInputs,
): Promise<AgentResult<SeoOptimizationOutput>> {
  const skill = await loadSkill(join(agentsRoot(), 'optimization', 'seo-optimizer'))

  // Resolve platform-specific SEO configs for all target platforms
  const platformConfigs: Record<string, PlatformSeoConfig> = {}
  for (const platform of inputs.platforms) {
    platformConfigs[platform] = getPlatformSeoConfig(platform)
  }

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  const prompt = `Optimize the following content items for SEO on their target platforms.

## Brand Keywords
${inputs.brandKeywords.join(', ')}
${inputs.campaignKeywords ? `\n## Campaign Keywords\n${inputs.campaignKeywords.join(', ')}` : ''}

## Platform SEO Configurations
${JSON.stringify(platformConfigs, null, 2)}

## Content Items to Optimize
${JSON.stringify(inputs.contentItems, null, 2)}

Apply all platform-specific SEO rules to each content item. For TikTok content, optimize across all 4 indexable layers (caption text, OCR text overlay, audio keywords, hashtags).

Output a JSON object with "items" (array of optimization results) and "summary" (aggregate stats).`

  const systemPrompt = `${skill.systemPrompt}${knowledgeSection}`

  return executeAgent<SeoOptimizationOutput>('seo-optimizer', {
    prompt,
    systemPrompt,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: seoOptimizationOutputSchema,
    maxTurns: 20,
  })
}

// --- Content Humanization ---

export interface HumanizationInputs {
  contentItems: Array<{
    contentId: string
    platform: string
    text: string
    brandVoice?: {
      tone: string
      style: string
      principles: string[]
    }
  }>
  aiDetectionThreshold: number
  bannedPhrases?: string[]
  brandVoiceConfig?: {
    tone: string
    style: string
    principles: string[]
    bannedPhrases?: string[]
  }
}

const DEFAULT_BANNED_PHRASES = [
  "In today's digital landscape",
  "It's important to note",
  "Whether you're a",
  'Dive into',
  'Unlock the power',
  'In conclusion',
  'Furthermore',
  'Moreover',
  'It is worth mentioning',
  'At the end of the day',
  'In the realm of',
  'Navigating the',
  'Delve into',
  'Embark on',
  'Harness the power',
  'Leverage the',
  'Tapestry of',
  'Bustling',
  'Pivotal',
  'Groundbreaking',
  'Fostering',
  'Seamlessly',
  'Utilize',
  'Facilitate',
]

/**
 * Run the Content Humanization agent.
 * Rewrites AI-generated text to pass AI-detection checks while preserving
 * meaning, brand voice, and platform-native formatting. Applies anti-detection
 * techniques including structure variation, deliberate imperfection, banned
 * phrase removal, and platform-specific writing conventions.
 *
 * Uses model: sonnet — creative rewriting requires stronger language model.
 */
export async function runContentHumanizer(
  inputs: HumanizationInputs,
): Promise<AgentResult<HumanizationOutput>> {
  const skill = await loadSkill(join(agentsRoot(), 'optimization', 'content-humanizer'))

  // Merge default banned phrases with user-supplied ones
  const allBannedPhrases = [
    ...DEFAULT_BANNED_PHRASES,
    ...(inputs.bannedPhrases ?? []),
    ...(inputs.brandVoiceConfig?.bannedPhrases ?? []),
  ]
  // Deduplicate
  const uniqueBannedPhrases = [...new Set(allBannedPhrases)]

  const prompt = `Humanize the following AI-generated content items to pass AI-detection checks.

## AI-Detection Threshold Target
Score BELOW ${inputs.aiDetectionThreshold}% AI-detected for each item.

## Banned Phrases (MUST be removed or replaced)
${uniqueBannedPhrases.map(p => `- "${p}"`).join('\n')}

${inputs.brandVoiceConfig ? `## Brand Voice Configuration
- Tone: ${inputs.brandVoiceConfig.tone}
- Style: ${inputs.brandVoiceConfig.style}
- Principles: ${inputs.brandVoiceConfig.principles.join(', ')}` : ''}

## Content Items to Humanize
${JSON.stringify(inputs.contentItems, null, 2)}

For each item:
1. Identify and remove AI-generated markers
2. Apply platform-specific writing conventions for the target platform
3. Vary sentence structure, length, and rhythm
4. Insert deliberate imperfections (contractions, fragments, rhetorical questions)
5. Preserve original meaning, keywords, and brand voice
6. Self-assess AI-detection score (target: below ${inputs.aiDetectionThreshold}%)

Output a JSON object with "items" (array of humanization results) and "summary" (aggregate stats).`

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  const systemPrompt = `${skill.systemPrompt}${knowledgeSection}`

  return executeAgent<HumanizationOutput>('content-humanizer', {
    prompt,
    systemPrompt,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: humanizationOutputSchema,
    maxTurns: 25,
  })
}

// --- A/B Test Designer ---

export type {AbTestInputs, ContentVariation}

/**
 * Run the A/B Test Designer agent.
 * Generates 3-5 variations per content item — varying hooks, captions,
 * hashtags, format, or CTAs — each with a clear hypothesis about what
 * is being tested and why.
 *
 * Uses model: haiku — fast and cheap for variation generation.
 */
export async function runAbTestDesigner(
  inputs: AbTestInputs,
): Promise<AgentResult<AbTestOutput>> {
  const skill = await loadSkill(join(agentsRoot(), 'optimization', 'ab-test-designer'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  const prompt = `Generate A/B test variations for the following content items.

## Content Items

${JSON.stringify(inputs.contentItems, null, 2)}

## Brand Voice
Tone: ${inputs.brandVoiceTone}
Style: ${inputs.brandVoiceStyle}

## Instructions
- Generate 3-5 variations per content item
- Vary hooks, captions, hashtags, format, or CTAs
- Each variation must have a clear hypothesis
- Link every variation to its original content item ID
- Produce structured JSON output matching the schema`

  const systemPrompt = `${skill.systemPrompt}${knowledgeSection}`

  return executeAgent<AbTestOutput>('ab-test-designer', {
    prompt,
    systemPrompt,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: abTestOutputSchema,
  })
}

/** Transform AbTestOutput.variations into pipeline-ready ContentVariation[] */
export function buildVariationsForPipeline(output: AbTestOutput): ContentVariation[] {
  return output.variations.map((v) => ({
    variationId: v.variationId,
    originalContentItemId: v.originalContentItemId,
    testId: v.testId,
    variationType: v.variationType,
    variationDescription: v.variationDescription,
    content: v.content,
  }))
}

// --- Hashtag Strategist ---

export interface HashtagStrategistInputs {
  contentItems: Array<{
    id: string
    contentText: string
    platform: string
    topic: string
    keywords: string[]
  }>
  brandName: string
  industryVertical: string
}

/**
 * Run the Hashtag Strategist agent.
 * Researches and recommends optimal hashtag sets per platform for each content
 * item. Injects platform-specific hashtag limits into the prompt and validates
 * output against hashtagStrategyOutputSchema.
 *
 * Uses model: haiku — structured research and optimization task.
 */
export async function runHashtagStrategist(
  inputs: HashtagStrategistInputs,
): Promise<AgentResult<HashtagStrategyOutput[]>> {
  const skill = await loadSkill(join(agentsRoot(), 'optimization', 'hashtag-strategist'))

  const prompt = `Research and recommend optimal hashtag sets for the following content items.

Brand: ${inputs.brandName}
Industry: ${inputs.industryVertical}

Content Items:
${inputs.contentItems.map((item, i) => `
${i + 1}. [${item.platform}] ID: ${item.id}
   Topic: ${item.topic}
   Keywords: ${item.keywords.join(', ')}
   Content: ${item.contentText.slice(0, 500)}
`).join('\n')}

Platform Hashtag Limits:
- TikTok: ${PLATFORM_HASHTAG_LIMITS.tiktok.recommended} recommended (max ${PLATFORM_HASHTAG_LIMITS.tiktok.max})
- Instagram: ${PLATFORM_HASHTAG_LIMITS.instagram.recommended} recommended (max ${PLATFORM_HASHTAG_LIMITS.instagram.max})
- Facebook: ${PLATFORM_HASHTAG_LIMITS.facebook.recommended} recommended (max ${PLATFORM_HASHTAG_LIMITS.facebook.max})
- Reddit: No hashtags (skip)

Return a JSON array with one entry per content item.`

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  const systemPrompt = `${skill.systemPrompt}${knowledgeSection}`

  const result = await executeAgent<HashtagStrategyOutput[]>('hashtag-strategist', {
    prompt,
    systemPrompt,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: z.array(hashtagStrategyOutputSchema),
    maxTurns: 15,
  })

  // Post-validation: check hashtag counts per platform
  for (const output of result.outputs) {
    const warnings = validateHashtagCounts(output, PLATFORM_HASHTAG_LIMITS)
    if (warnings.length > 0) {
      // Log warnings but don't fail — agent may have good reasons
      console.warn(`Hashtag count warnings for ${output.contentItemId}:`, warnings)
    }
  }

  return result
}

/**
 * Post-validation: verify each platform set respects its hashtag limit.
 * Returns array of warning strings for any violations (non-blocking).
 */
export function validateHashtagCounts(
  output: HashtagStrategyOutput,
  limits: Record<string, {min: number; max: number; recommended: number}>,
): string[] {
  const warnings: string[] = []

  for (const platformSet of output.platformSets) {
    const platformLimits = limits[platformSet.platform]
    if (!platformLimits) {
      warnings.push(`Unknown platform '${platformSet.platform}' — no hashtag limits defined`)
      continue
    }

    const count = platformSet.hashtags.length
    if (count > platformLimits.max) {
      warnings.push(
        `${platformSet.platform}: ${count} hashtags exceeds max ${platformLimits.max}`,
      )
    }

    if (count < platformLimits.min) {
      warnings.push(
        `${platformSet.platform}: ${count} hashtags below min ${platformLimits.min}`,
      )
    }
  }

  return warnings
}
