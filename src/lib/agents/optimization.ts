import {join} from 'node:path'

import {seoOptimizationOutputSchema} from '../schemas/seo-schema.js'
import type {SeoOptimizationOutput, SeoContentItem, PlatformSeoConfig} from '../schemas/seo-schema.js'

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
