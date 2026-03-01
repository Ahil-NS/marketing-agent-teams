import {join} from 'node:path'

import {seoOptimizationOutputSchema} from '../schemas/seo-schema.js'
import type {SeoOptimizationOutput, SeoContentItem, PlatformSeoConfig} from '../schemas/seo-schema.js'
import {humanizationOutputSchema} from '../schemas/humanization-schema.js'
import type {HumanizationOutput} from '../schemas/humanization-schema.js'

import {executeAgent} from './agent-executor.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'
import {getPlatformSeoConfig} from './seo-config.js'
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
