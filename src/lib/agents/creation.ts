import {join} from 'node:path'

import {
  creationInputsSchema,
  redditContentPackageSchema,
  tiktokContentPackageSchema,
  facebookContentPackageSchema,
  instagramContentPackageSchema,
  hookWriterOutputSchema,
  hookWriterInputsSchema,
  atomizedContentSchema,
  atomizationInputsSchema,
} from '../schemas/creation-schema.js'
import type {
  RedditContentPackage,
  TikTokContentPackage,
  FacebookContentPackage,
  InstagramContentPackage,
  ContentItem,
  CreationInputs,
  CreationStageOutput,
  HookWriterInputs,
  HookWriterOutput,
  ImagePrompt,
  VideoPrompt,
  AtomizedContent,
  AtomizationInputs,
} from '../schemas/creation-schema.js'

import {executeAgent} from './agent-executor.js'
import {AgentValidationError} from './errors.js'
import {agentsRoot} from './paths.js'
import {loadSkill} from './skill-loader.js'
import type {AgentResult} from './types.js'

/**
 * Build the vertical context section for agent system prompts.
 * Returns a vertical knowledge section if verticalContext is provided, empty string otherwise.
 * Injection order: Agent SKILL.md → Agent knowledge/ → Vertical knowledge/ (vertical is last).
 */
function buildVerticalSection(verticalContext?: string): string {
  return verticalContext
    ? `\n\n## Vertical Context\n\n${verticalContext}`
    : ''
}

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
- Optionally include AI image generation prompts when content strategy warrants visual assets (infographics, data visualizations, before/after images)

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
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
- Include Veo 3 video generation prompts for EVERY script with promptId, contentItemId, sceneDescription, cameraMovement, transitions, duration, audioMusic, visualStyle, brandElements
- Create pattern interrupts every 3-5 seconds in scripts
- Captions must include 4-6 hashtags: trending + niche + brand

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
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
    const videoPrompts: VideoPrompt[] = videoPrompt
      ? [{
        promptId: script.scriptId + '-vid',
        contentItemId: script.scriptId,
        promptText: videoPrompt.veo3Prompt,
        generator: 'veo3' as const,
        sceneDescription: videoPrompt.veo3Prompt,
        cameraMovement: 'tracking',
        transitions: ['cut', 'jump cut'],
        duration: videoPrompt.duration,
        audioMusic: pkg.metadata.trendingSounds[0]?.name ?? 'background music',
        visualStyle: (videoPrompt.style === 'editorial' ? 'editorial' : videoPrompt.style) as VideoPrompt['visualStyle'],
        brandElements: videoPrompt.visualElements,
      }]
      : []
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
      videoPrompts,
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
- Generate AI image prompts for posts with visual content (format: image, video, carousel) with promptId, contentItemId, generator, style, aspectRatio, brandElements, visualConcept, estimatedQuality
- NEVER use engagement bait patterns (tag a friend, like if you agree, share to win)

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
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
- Write AI image generation prompts for EVERY post (Flux, Ideogram, or GPT Image) with promptId, contentItemId, style, aspectRatio, generator, brandElements, visualConcept, estimatedQuality
- Write Veo 3 video generation prompts for EVERY Reel with promptId, contentItemId, sceneDescription, cameraMovement, transitions, duration, audioMusic, visualStyle, brandElements
- Apply hashtag strategy: 20-25 per post (broad + niche + brand)
- Design Stories with interactive stickers and engagement elements
- Optimize for saves and shares — the key algorithm signals

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
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

  // Build imagePrompts lookup: postId -> ImagePrompt[]
  const imagePromptsByPost = new Map<string, ImagePrompt[]>()
  for (const ip of pkg.imagePrompts) {
    const existing = imagePromptsByPost.get(ip.postId) ?? []
    existing.push({
      promptId: ip.postId + '-img',
      contentItemId: ip.postId,
      promptText: ip.promptText,
      generator: ip.generator,
      style: ip.style,
      aspectRatio: ip.aspectRatio,
      brandElements: [],
      visualConcept: ip.promptText.slice(0, 80),
      estimatedQuality: 'medium' as const,
    })
    imagePromptsByPost.set(ip.postId, existing)
  }

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
    imagePrompts: imagePromptsByPost.get(post.postId) ?? [],
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
    videoPrompts: [{
      promptId: reel.reelId + '-vid',
      contentItemId: reel.reelId,
      promptText: reel.visualDirections,
      generator: 'veo3' as const,
      sceneDescription: reel.visualDirections,
      cameraMovement: 'tracking',
      transitions: ['cut'],
      duration: `${reel.duration}s`,
      audioMusic: reel.musicSuggestion,
      visualStyle: 'cinematic' as const,
      brandElements: [],
    }],
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
 * Run the Hook Writer agent.
 * Processes ContentItem[] from platform agents and generates platform-tailored
 * hook variations with A/B pairs and confidence scoring.
 *
 * Sequential execution: Runs AFTER platform agents complete (Phase 2 of creation stage).
 * Inputs: ContentItem[] + BrandVoiceConfig + CampaignPlan
 * Output: HookWriterOutput (hooks, topPicks, abPairs, analysis)
 */
export async function runHookWriter(inputs: HookWriterInputs): Promise<AgentResult<HookWriterOutput>> {
  const parsed = hookWriterInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('hook-writer', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'hook-writer'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('hook-writer', {
    prompt: `Generate platform-tailored hook variations for the following content items:

## Content Items
${JSON.stringify(inputs.contentItems, null, 2)}

## Brand Voice
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
- Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ')}
- Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ')}

## Campaign Plan
${JSON.stringify(inputs.campaignPlan, null, 2)}

## Requirements
- Generate 3-5 hook variations for EACH content item
- Each hook must use a clear psychological trigger from the taxonomy
- Each hook must respect platform-specific constraints (character limits, norms)
- Score each hook with a confidence score between 0.0 and 1.0
- Generate at least one A/B pair per content item with meaningful variation
- Select a top pick per content item per platform with rationale
- Include analysis summary with platform breakdown and trigger distribution
- All hooks must align with brand voice and be truthful (no clickbait)

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: hookWriterOutputSchema,
    maxTurns: 20,
  })
}

/**
 * Run the Content Atomizer agent.
 * Breaks long-form content (campaign plan themes, content calendar entries) into
 * platform-specific micro-content with full source traceability.
 *
 * Parallel execution: Runs independently in Phase 1 alongside platform agents (from campaign plan).
 * Inputs: sourceContent + BrandVoiceConfig + targetPlatforms + atomizationStrategy
 * Output: AtomizedContent (atomizationId, sourceContentId, microContent[])
 */
export async function runContentAtomizer(inputs: AtomizationInputs): Promise<AgentResult<AtomizedContent>> {
  const parsed = atomizationInputsSchema.safeParse(inputs)
  if (!parsed.success) {
    throw new AgentValidationError('content-atomizer', parsed.error)
  }

  const skill = await loadSkill(join(agentsRoot(), 'creation', 'content-atomizer'))

  const knowledgeSection = skill.knowledgeContext
    ? `\n\n## Knowledge Base\n\n${skill.knowledgeContext}`
    : ''

  return executeAgent('content-atomizer', {
    prompt: `Atomize the following source content into platform-specific micro-content:

## Source Content
${inputs.sourceContent}

## Brand Voice
- Tone: ${inputs.brandVoiceConfig.tone}
- Communication Style: ${inputs.brandVoiceConfig.communicationStyle}
- Brand Principles: ${inputs.brandVoiceConfig.brandPrinciples.join(', ')}
- Banned Phrases: ${inputs.brandVoiceConfig.bannedPhrases.join(', ')}

## Target Platforms
${inputs.targetPlatforms.join(', ')}

## Atomization Strategy
${inputs.atomizationStrategy}
- comprehensive: Extract ALL possible micro-content (8-15 pieces)
- highlights: Top 3-5 most impactful elements
- key-points: Core message + 1-2 supporting points (2-3 pieces)

${inputs.campaignId ? `## Campaign ID\n${inputs.campaignId}` : ''}

## Requirements
- Produce platform-specific micro-content for EACH target platform
- EVERY micro-content piece MUST include a traceabilityLink back to source content
- Respect platform character limits, hashtag conventions, and formatting rules
- Maintain brand voice consistency across all atomized pieces
- Create ADDITIONAL content from different angles — do NOT duplicate platform agent output
- Each piece must stand alone — readers should not need the original to understand it
- Include platform-appropriate metadata (characterCount, hashtags, format details)

Follow your output format specification exactly. Output valid JSON.`,
    systemPrompt: `${skill.systemPrompt}${knowledgeSection}${buildVerticalSection(inputs.verticalContext)}`,
    allowedTools: skill.tools,
    model: skill.model,
    outputSchema: atomizedContentSchema,
    maxTurns: 20,
  })
}

/**
 * Convert AtomizedContent to ContentItem[] for downstream pipeline stages.
 * Preserves traceability by storing sourceSection and traceabilityLink in metadata.
 * @param campaignId - The campaign ID to assign to each ContentItem (must match platform agent items).
 */
export function atomizedContentToContentItems(atomized: AtomizedContent, campaignId: string): ContentItem[] {
  const now = new Date().toISOString()
  return atomized.microContent.map((micro) => ({
    itemId: micro.itemId,
    platform: micro.platform,
    contentType: micro.contentType,
    title: micro.title,
    body: micro.body,
    metadata: {
      ...micro.metadata,
      sourceSection: micro.sourceSection,
      traceabilityLink: micro.traceabilityLink,
      atomizationId: atomized.atomizationId,
      sourceContentId: atomized.sourceContentId,
    },
    status: 'draft' as const,
    generatedBy: 'content-atomizer',
    agentName: 'content-atomizer',
    campaignId,
    createdAt: now,
  }))
}

/**
 * Run the creation stage — TWO-PHASE execution:
 *   Phase 1 (parallel): All four platform agents + content atomizer via Promise.allSettled() (FR63)
 *   Phase 2 (sequential): Hook writer processes ContentItem[] from Phase 1
 *
 * Uses Promise.allSettled() for partial failure handling (FR3, degraded mode).
 * If any platform agent fails, the others' results are still collected.
 * Content atomizer runs in Phase 1 alongside platform agents (independent, from campaign plan).
 * Hook writer runs ONLY if at least one platform agent produced content items.
 */
export async function runCreationStage(inputs: CreationInputs): Promise<CreationStageOutput> {
  // Build atomization inputs from creation inputs (campaign plan themes as source content)
  const atomizerInputs: AtomizationInputs = {
    sourceContent: JSON.stringify(inputs.campaignPlan, null, 2),
    brandVoiceConfig: inputs.brandVoiceConfig,
    targetPlatforms: ['reddit', 'tiktok', 'facebook', 'instagram'],
    atomizationStrategy: 'comprehensive',
    campaignId: inputs.campaignPlan.planId,
    verticalContext: inputs.verticalContext,
  }

  // Phase 1: Platform agents + content atomizer in PARALLEL (FR63)
  const [redditResult, tiktokResult, facebookResult, instagramResult, atomizerResult] = await Promise.allSettled([
    runRedditCreator(inputs),
    runTikTokCreator(inputs),
    runFacebookCreator(inputs),
    runInstagramCreator(inputs),
    runContentAtomizer(atomizerInputs),
  ])

  // Handle partial success (FR3, degraded mode)
  const redditPackage = redditResult.status === 'fulfilled' ? redditResult.value.outputs : null
  const tiktokPackage = tiktokResult.status === 'fulfilled' ? tiktokResult.value.outputs : null
  const facebookPackage = facebookResult.status === 'fulfilled' ? facebookResult.value.outputs : null
  const instagramPackage = instagramResult.status === 'fulfilled' ? instagramResult.value.outputs : null
  const atomizedContent = atomizerResult.status === 'fulfilled' ? atomizerResult.value.outputs : null

  // Convert to ContentItem[] for downstream stages
  const campaignId = inputs.campaignPlan.planId
  const contentItems: ContentItem[] = [
    ...(redditPackage ? redditPackageToContentItems(redditPackage) : []),
    ...(tiktokPackage ? tiktokPackageToContentItems(tiktokPackage) : []),
    ...(facebookPackage ? facebookPackageToContentItems(facebookPackage) : []),
    ...(instagramPackage ? instagramPackageToContentItems(instagramPackage) : []),
    ...(atomizedContent ? atomizedContentToContentItems(atomizedContent, campaignId) : []),
  ]

  const phase1Agents = ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'content-atomizer']
  const agentsExecuted = [...phase1Agents]
  const phase1Results = [redditResult, tiktokResult, facebookResult, instagramResult, atomizerResult]

  // Capture error reasons for debugging (M1: don't silently discard failure info)
  const agentErrors: Record<string, string> = {}
  for (const [i, agent] of phase1Agents.entries()) {
    const result = phase1Results[i]
    if (result.status === 'rejected') {
      agentErrors[agent] = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason)
    }
  }

  const succeededAgents = phase1Agents.filter((_, i) => phase1Results[i].status === 'fulfilled')
  const failedAgents = phase1Agents.filter((_, i) => phase1Results[i].status === 'rejected')

  // Phase 2: Hook writer runs AFTER platform agents, only if platform content items exist.
  // Atomized micro-content is excluded — it's already distilled and doesn't need hook variations.
  const platformContentItems = contentItems.filter((item) => item.agentName !== 'content-atomizer')
  let hookWriterOutput: HookWriterOutput | null = null
  if (platformContentItems.length > 0) {
    agentsExecuted.push('hook-writer')
    try {
      const hookResult = await runHookWriter({
        contentItems: platformContentItems,
        brandVoiceConfig: inputs.brandVoiceConfig,
        campaignPlan: inputs.campaignPlan,
        verticalContext: inputs.verticalContext,
      })
      hookWriterOutput = hookResult.outputs
      succeededAgents.push('hook-writer')
    } catch (error) {
      failedAgents.push('hook-writer')
      agentErrors['hook-writer'] = error instanceof Error
        ? error.message
        : String(error)
    }
  } else {
    // No platform content items — hook writer skipped (not executed, not failed)
    agentErrors['hook-writer'] = 'Skipped: no content items from platform agents'
  }

  return {
    redditPackage,
    tiktokPackage,
    facebookPackage,
    instagramPackage,
    atomizedOutput: atomizedContent,
    contentItems,
    hookWriterOutput,
    stageMetadata: {
      agentsExecuted,
      agentsSucceeded: succeededAgents,
      agentsFailed: failedAgents,
      ...(Object.keys(agentErrors).length > 0 ? {agentErrors} : {}),
    },
  }
}
