import {join} from 'node:path'

import {
  creationInputsSchema,
  redditContentPackageSchema,
  tiktokContentPackageSchema,
} from '../schemas/creation-schema.js'
import type {
  RedditContentPackage,
  TikTokContentPackage,
  ContentItem,
  CreationInputs,
  CreationStageOutput,
} from '../schemas/creation-schema.js'

import {executeAgent} from './agent-executor.js'
import {AgentValidationError} from './errors.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'
import type {AgentResult} from './types.js'

/**
 * Run the Reddit Creator agent.
 * Produces a full Reddit content package from campaign plan and calendar inputs.
 *
 * Parallel execution: Runs independently alongside TikTok creator in the creation stage (FR63).
 * Inputs: CampaignPlan + ContentCalendar + ChannelOptimizationPlan + BrandVoiceConfig + TrendBrief
 * Output: RedditContentPackage (posts, comments, variations, metadata)
 */
export async function runRedditCreator(inputs: CreationInputs): Promise<AgentResult<RedditContentPackage>> {
  const parsed = creationInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('reddit-creator', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'reddit-creator'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('reddit-creator', {
    prompt: `Create Reddit content packages for the following campaign:

## Campaign Plan
${JSON.stringify(inputs.campaignPlan, null, 2)}

## Content Calendar
${JSON.stringify(inputs.contentCalendar, null, 2)}

## Channel Optimization
${JSON.stringify(inputs.channelOptimizationPlan, null, 2)}

## Brand Voice
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
- Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ')}
- Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ')}

## Trend Intelligence
${JSON.stringify(inputs.trendBrief, null, 2)}

## Requirements
- Generate Reddit post packages for each content calendar entry targeting Reddit
- Each post must sound like a genuine community member, NOT a marketing bot
- Include title variants, humanized body text, first-comment strategy, engagement plan
- Respect subreddit-specific norms and anti-spam rules
- Apply the 90/10 rule: 90% value, 10% promotion

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: redditContentPackageSchema,
    maxTurns: 20,
  })
}

/**
 * Run the TikTok Creator agent.
 * Produces a full TikTok content package with scripts, captions, video prompts, and 4-layer SEO.
 *
 * Parallel execution: Runs independently alongside Reddit creator in the creation stage (FR63).
 * Inputs: CampaignPlan + ContentCalendar + ChannelOptimizationPlan + BrandVoiceConfig + TrendBrief
 * Output: TikTokContentPackage (scripts, captions, videoPrompts, variations, metadata)
 */
export async function runTikTokCreator(inputs: CreationInputs): Promise<AgentResult<TikTokContentPackage>> {
  const parsed = creationInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('tiktok-creator', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'tiktok-creator'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('tiktok-creator', {
    prompt: `Create TikTok content packages for the following campaign:

## Campaign Plan
${JSON.stringify(inputs.campaignPlan, null, 2)}

## Content Calendar
${JSON.stringify(inputs.contentCalendar, null, 2)}

## Channel Optimization
${JSON.stringify(inputs.channelOptimizationPlan, null, 2)}

## Brand Voice
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
- Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ')}
- Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ')}

## Trend Intelligence
${JSON.stringify(inputs.trendBrief, null, 2)}

## Requirements
- Generate TikTok content packages for each content calendar entry targeting TikTok
- Every script must have a hook that stops the scroll within 2 seconds
- Apply 4-layer SEO: caption keywords, OCR text optimization, audio keyword density, hashtag strategy
- Include Veo 3 video generation prompts for each script
- Create pattern interrupts every 3-5 seconds in scripts
- Captions must include 4-6 hashtags: trending + niche + brand

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: tiktokContentPackageSchema,
    maxTurns: 20,
  })
}

/**
 * Convert a RedditContentPackage to ContentItem[] for downstream pipeline stages.
 */
function redditPackageToContentItems(pkg: RedditContentPackage): ContentItem[] {
  const now = new Date().toISOString()
  return pkg.posts.map((post) => ({
    itemId: post.postId,
    platform: 'reddit' as const,
    contentType: 'post',
    title: post.title,
    body: post.body,
    metadata: {
      subreddit: post.subreddit,
      flair: post.flair,
      postType: post.postType,
      firstComment: post.firstComment,
      titleVariations: post.titleVariations,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'reddit-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))
}

/**
 * Convert a TikTokContentPackage to ContentItem[] for downstream pipeline stages.
 */
function tiktokPackageToContentItems(pkg: TikTokContentPackage): ContentItem[] {
  const now = new Date().toISOString()
  return pkg.scripts.map((script) => {
    const caption = pkg.captions.find((c) => c.scriptId === script.scriptId)
    const videoPrompt = pkg.videoPrompts.find((v) => v.scriptId === script.scriptId)
    return {
      itemId: script.scriptId,
      platform: 'tiktok' as const,
      contentType: 'video-script',
      title: script.hook,
      body: `${script.hook}\n\n${script.body}\n\n${script.cta}`,
      metadata: {
        hook: script.hook,
        duration: script.duration,
        onScreenText: script.onScreenText,
        veo3Prompt: videoPrompt?.veo3Prompt ?? '',
        hashtags: caption?.hashtags ?? [],
        suggestedSound: pkg.metadata.trendingSounds[0]?.name ?? '',
      },
      status: 'draft' as const,
      generatedBy: pkg.generatedBy,
      agentName: 'tiktok-creator',
      campaignId: pkg.campaignId,
      createdAt: now,
    }
  })
}

/**
 * Run the creation stage — executes Reddit and TikTok agents in PARALLEL (FR63).
 * Uses Promise.allSettled() for partial failure handling (FR3, degraded mode).
 *
 * If one agent fails, the other's results are still collected and returned.
 * The combined output includes per-platform packages and a flattened ContentItem[]
 * array for downstream stages (optimization → quality → review → distribution).
 */
export async function runCreationStage(inputs: CreationInputs): Promise<CreationStageOutput> {
  // Run Reddit and TikTok agents in PARALLEL (FR63)
  const [redditResult, tiktokResult] = await Promise.allSettled([
    runRedditCreator(inputs),
    runTikTokCreator(inputs),
  ])

  // Handle partial success (FR3, degraded mode)
  const redditPackage = redditResult.status === 'fulfilled' ? redditResult.value.outputs : null
  const tiktokPackage = tiktokResult.status === 'fulfilled' ? tiktokResult.value.outputs : null

  // Convert to ContentItem[] for downstream stages
  const contentItems: ContentItem[] = [
    ...(redditPackage ? redditPackageToContentItems(redditPackage) : []),
    ...(tiktokPackage ? tiktokPackageToContentItems(tiktokPackage) : []),
  ]

  return {
    redditPackage,
    tiktokPackage,
    contentItems,
    stageMetadata: {
      agentsExecuted: ['reddit-creator', 'tiktok-creator'],
      agentsSucceeded: [
        ...(redditPackage ? ['reddit-creator'] : []),
        ...(tiktokPackage ? ['tiktok-creator'] : []),
      ],
      agentsFailed: [
        ...(redditResult.status === 'rejected' ? ['reddit-creator'] : []),
        ...(tiktokResult.status === 'rejected' ? ['tiktok-creator'] : []),
      ],
    },
  }
}
