import {join} from 'node:path'

import {
  creationInputsSchema,
  redditContentPackageSchema,
  tiktokContentPackageSchema,
  facebookContentPackageSchema,
  instagramContentPackageSchema,
} from '../schemas/creation-schema.js'
import type {
  RedditContentPackage,
  TikTokContentPackage,
  FacebookContentPackage,
  InstagramContentPackage,
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
 * Run the Facebook Creator agent.
 * Produces a full Facebook content package with posts, stories, and engagement strategies.
 *
 * Parallel execution: Runs independently alongside other creation agents (FR63).
 * Inputs: CampaignPlan + ContentCalendar + ChannelOptimizationPlan + BrandVoiceConfig + TrendBrief
 * Output: FacebookContentPackage (posts, stories, variations, metadata)
 */
export async function runFacebookCreator(inputs: CreationInputs): Promise<AgentResult<FacebookContentPackage>> {
  const parsed = creationInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('facebook-creator', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'facebook-creator'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('facebook-creator', {
    prompt: `Create Facebook content packages for the following campaign:

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
- Generate Facebook content packages for each content calendar entry targeting Facebook
- Create community-oriented copy that drives meaningful interactions (comments, shares)
- Include engagement-driving questions — NOT engagement bait
- Design Group-specific content respecting each group's culture and norms
- Include Stories with interactive frames (polls, quizzes, questions)
- Plan boost and cross-posting strategies
- NEVER use engagement bait patterns (tag a friend, like if you agree, share to win)

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: facebookContentPackageSchema,
    maxTurns: 20,
  })
}

/**
 * Run the Instagram Creator agent.
 * Produces a full Instagram content package with posts, Reels, Stories, carousels, and image prompts.
 *
 * Parallel execution: Runs independently alongside other creation agents (FR63).
 * Inputs: CampaignPlan + ContentCalendar + ChannelOptimizationPlan + BrandVoiceConfig + TrendBrief
 * Output: InstagramContentPackage (posts, reels, stories, carousels, imagePrompts, variations, metadata)
 */
export async function runInstagramCreator(inputs: CreationInputs): Promise<AgentResult<InstagramContentPackage>> {
  const parsed = creationInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('instagram-creator', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'instagram-creator'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('instagram-creator', {
    prompt: `Create Instagram content packages for the following campaign:

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
- Generate Instagram content packages for each content calendar entry targeting Instagram
- Every post must be visual-first with detailed art direction
- Include carousel structures with swipe narratives and save-worthy content
- Reels scripts must have hooks, visual concepts, and music suggestions
- Write image generation prompts for each visual concept (Flux, Ideogram, or GPT Image)
- Apply hashtag strategy: 20-25 per post (broad + niche + brand)
- Design Stories with interactive stickers and engagement elements
- Optimize for saves and shares — the key algorithm signals

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: instagramContentPackageSchema,
    maxTurns: 20,
  })
}

/**
 * Convert a FacebookContentPackage to ContentItem[] for downstream pipeline stages.
 * Creates ContentItems for both posts and stories.
 */
function facebookPackageToContentItems(pkg: FacebookContentPackage): ContentItem[] {
  const now = new Date().toISOString()

  const postItems: ContentItem[] = pkg.posts.map((post) => ({
    itemId: post.postId,
    platform: 'facebook' as const,
    contentType: post.format,
    title: post.engagementHook,
    body: post.copy,
    metadata: {
      format: post.format,
      visualDescription: post.visualDescription,
      targetGroups: post.targetGroups,
      groupTargets: pkg.metadata.groupTargets,
      boostRecommendations: pkg.metadata.boostRecommendations,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'facebook-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  const storyItems: ContentItem[] = pkg.stories.map((story) => ({
    itemId: story.storyId,
    platform: 'facebook' as const,
    contentType: 'story',
    title: story.frames[0]?.content ?? 'Facebook Story',
    body: story.frames.map((f) => f.content).join('\n'),
    metadata: {
      frames: story.frames,
      interactions: story.interactions,
      duration: story.duration,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'facebook-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  return [...postItems, ...storyItems]
}

/**
 * Convert an InstagramContentPackage to ContentItem[] for downstream pipeline stages.
 * Creates ContentItems for posts, Reels, Stories, and Carousels.
 */
function instagramPackageToContentItems(pkg: InstagramContentPackage): ContentItem[] {
  const now = new Date().toISOString()

  const postItems: ContentItem[] = pkg.posts.map((post) => ({
    itemId: post.postId,
    platform: 'instagram' as const,
    contentType: post.format,
    title: post.caption.trim().split('\n')[0],
    body: post.caption,
    metadata: {
      format: post.format,
      hashtags: post.hashtags,
      visualConcept: post.visualConcept,
      artDirection: post.artDirection,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'instagram-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  const reelItems: ContentItem[] = pkg.reels.map((reel) => ({
    itemId: reel.reelId,
    platform: 'instagram' as const,
    contentType: 'reel',
    title: reel.hook,
    body: reel.script,
    metadata: {
      hook: reel.hook,
      duration: reel.duration,
      musicSuggestion: reel.musicSuggestion,
      visualDirections: reel.visualDirections,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'instagram-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  const storyItems: ContentItem[] = pkg.stories.map((story) => ({
    itemId: story.storyId,
    platform: 'instagram' as const,
    contentType: 'story',
    title: story.frames[0]?.content ?? 'Instagram Story',
    body: story.frames.map((f) => f.content).join('\n'),
    metadata: {
      frames: story.frames,
      stickers: story.stickers,
      interactions: story.interactions,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'instagram-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  const carouselItems: ContentItem[] = pkg.carousels.map((carousel) => ({
    itemId: carousel.carouselId,
    platform: 'instagram' as const,
    contentType: 'carousel',
    title: carousel.coverSlide,
    body: carousel.swipeNarrative,
    metadata: {
      slides: carousel.slides,
      swipeNarrative: carousel.swipeNarrative,
      coverSlide: carousel.coverSlide,
    },
    status: 'draft' as const,
    generatedBy: pkg.generatedBy,
    agentName: 'instagram-creator',
    campaignId: pkg.campaignId,
    createdAt: now,
  }))

  return [...postItems, ...reelItems, ...storyItems, ...carouselItems]
}

/**
 * Run the creation stage — executes all four platform agents in PARALLEL (FR63).
 * Uses Promise.allSettled() for partial failure handling (FR3, degraded mode).
 *
 * If any agent fails, the others' results are still collected and returned.
 * The combined output includes per-platform packages and a flattened ContentItem[]
 * array for downstream stages (optimization → quality → review → distribution).
 */
export async function runCreationStage(inputs: CreationInputs): Promise<CreationStageOutput> {
  // Run all four platform agents in PARALLEL (FR63)
  const [redditResult, tiktokResult, facebookResult, instagramResult] = await Promise.allSettled([
    runRedditCreator(inputs),
    runTikTokCreator(inputs),
    runFacebookCreator(inputs),
    runInstagramCreator(inputs),
  ])

  // Handle partial success (FR3, degraded mode)
  const redditPackage = redditResult.status === 'fulfilled' ? redditResult.value.outputs : null
  const tiktokPackage = tiktokResult.status === 'fulfilled' ? tiktokResult.value.outputs : null
  const facebookPackage = facebookResult.status === 'fulfilled' ? facebookResult.value.outputs : null
  const instagramPackage = instagramResult.status === 'fulfilled' ? instagramResult.value.outputs : null

  // Convert to ContentItem[] for downstream stages
  const contentItems: ContentItem[] = [
    ...(redditPackage ? redditPackageToContentItems(redditPackage) : []),
    ...(tiktokPackage ? tiktokPackageToContentItems(tiktokPackage) : []),
    ...(facebookPackage ? facebookPackageToContentItems(facebookPackage) : []),
    ...(instagramPackage ? instagramPackageToContentItems(instagramPackage) : []),
  ]

  const allAgents = ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator']
  const results = [redditResult, tiktokResult, facebookResult, instagramResult]

  // Capture error reasons for debugging (M1: don't silently discard failure info)
  const agentErrors: Record<string, string> = {}
  for (const [i, agent] of allAgents.entries()) {
    const result = results[i]
    if (result.status === 'rejected') {
      agentErrors[agent] = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason)
    }
  }

  return {
    redditPackage,
    tiktokPackage,
    facebookPackage,
    instagramPackage,
    contentItems,
    stageMetadata: {
      agentsExecuted: allAgents,
      agentsSucceeded: allAgents.filter((_, i) => results[i].status === 'fulfilled'),
      agentsFailed: allAgents.filter((_, i) => results[i].status === 'rejected'),
      ...(Object.keys(agentErrors).length > 0 ? {agentErrors} : {}),
    },
  }
}
