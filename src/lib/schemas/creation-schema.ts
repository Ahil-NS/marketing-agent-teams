import {z} from 'zod'

import {campaignPlanSchema, contentCalendarSchema, channelOptimizationPlanSchema} from './strategy-schema.js'

// ── Sub-schemas for Reddit Content Package ────────────────────────────────────

const redditFirstCommentSchema = z.object({
  body: z.string(),
  timing: z.string(),
  purpose: z.enum(['context', 'question', 'resource', 'tldr']),
})

const redditEngagementPlanSchema = z.object({
  responseTemplates: z.array(z.string()),
  followUpTiming: z.string(),
  crossPostSubreddits: z.array(z.string()),
})

const redditPostSchema = z.object({
  postId: z.string(),
  title: z.string().min(5).max(300),
  body: z.string().min(10),
  subreddit: z.string().min(1),
  flair: z.string(),
  postType: z.enum(['text', 'link', 'image']),
  titleVariations: z.array(z.string()).min(1),
  firstComment: redditFirstCommentSchema,
  engagementPlan: redditEngagementPlanSchema,
})

const redditCommentSchema = z.object({
  postId: z.string(),
  commentBody: z.string().min(5),
  timing: z.string(),
  purpose: z.enum(['engagement', 'value-add', 'followup', 'data']),
})

const redditVariationSchema = z.object({
  postId: z.string(),
  altTitle: z.string(),
  altBody: z.string(),
  rationale: z.string(),
})

const redditPostingScheduleEntrySchema = z.object({
  postId: z.string(),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
})

const redditMetadataSchema = z.object({
  targetSubreddits: z.array(z.string()).min(1),
  postingSchedule: z.array(redditPostingScheduleEntrySchema),
  crossPostStrategy: z.string(),
  estimatedEngagement: z.object({
    totalReach: z.number().nonnegative(),
    avgEngagementRate: z.number().min(0).max(1),
  }),
})

// ── RedditContentPackage (output of reddit-creator) ──────────────────────────

export const redditContentPackageSchema = z.object({
  posts: z.array(redditPostSchema).min(1),
  comments: z.array(redditCommentSchema),
  variations: z.array(redditVariationSchema),
  metadata: redditMetadataSchema,
  generatedBy: z.string(),
  campaignId: z.string(),
})

export type RedditContentPackage = z.infer<typeof redditContentPackageSchema>

// ── Sub-schemas for TikTok Content Package ────────────────────────────────────

const tiktokScriptSchema = z.object({
  scriptId: z.string(),
  hook: z.string().min(5),
  body: z.string().min(10),
  cta: z.string().min(3),
  onScreenText: z.array(z.string()).min(1),
  duration: z.enum(['15s', '30s', '60s']),
  visualDirections: z.string(),
})

const tiktokCaptionSchema = z.object({
  scriptId: z.string(),
  captionText: z.string().min(10),
  hashtags: z.array(z.string()).min(1),
  keywords: z.array(z.string()).min(1),
})

const tiktokVideoPromptSchema = z.object({
  scriptId: z.string(),
  veo3Prompt: z.string().min(20),
  style: z.enum(['cinematic', 'lo-fi', 'clean', 'vibrant', 'raw', 'editorial']),
  duration: z.enum(['15s', '30s', '60s']),
  visualElements: z.array(z.string()),
})

const tiktokVariationSchema = z.object({
  scriptId: z.string(),
  altHook: z.string(),
  altCta: z.string(),
  rationale: z.string(),
})

const tiktokTrendingSoundSchema = z.object({
  name: z.string(),
  relevance: z.string(),
})

const tiktokPostingScheduleEntrySchema = z.object({
  scriptId: z.string(),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
})

const tiktokMetadataSchema = z.object({
  trendingSounds: z.array(tiktokTrendingSoundSchema),
  effects: z.array(z.string()),
  postingSchedule: z.array(tiktokPostingScheduleEntrySchema),
  hashtagStrategy: z.string(),
})

// ── TikTokContentPackage (output of tiktok-creator) ─────────────────────────

export const tiktokContentPackageSchema = z.object({
  scripts: z.array(tiktokScriptSchema).min(1),
  captions: z.array(tiktokCaptionSchema).min(1),
  videoPrompts: z.array(tiktokVideoPromptSchema).min(1),
  variations: z.array(tiktokVariationSchema),
  metadata: tiktokMetadataSchema,
  generatedBy: z.string(),
  campaignId: z.string(),
})

export type TikTokContentPackage = z.infer<typeof tiktokContentPackageSchema>

// ── Sub-schemas for Facebook Content Package ─────────────────────────────────

const facebookStoryFrameSchema = z.object({
  frameNumber: z.number().int().positive(),
  content: z.string().min(1),
  visualDescription: z.string().min(1),
  duration: z.number().positive().max(20),
})

const facebookPostSchema = z.object({
  postId: z.string().min(1),
  copy: z.string().min(5),
  format: z.enum(['text', 'image', 'video', 'carousel', 'link']),
  visualDescription: z.string().min(1),
  engagementHook: z.string().min(5),
  targetGroups: z.array(z.string()),
})

const facebookStorySchema = z.object({
  storyId: z.string().min(1),
  frames: z.array(facebookStoryFrameSchema).min(1),
  interactions: z.array(z.string()).min(1),
  duration: z.number().positive(),
})

const facebookVariationSchema = z.object({
  postId: z.string().min(1),
  altCopy: z.string().min(5),
  altVisual: z.string(),
  rationale: z.string().min(5),
})

const facebookPostingScheduleEntrySchema = z.object({
  contentId: z.string().min(1),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
})

const facebookMetadataSchema = z.object({
  postingSchedule: z.array(facebookPostingScheduleEntrySchema),
  groupTargets: z.array(z.string()),
  boostRecommendations: z.string().min(1),
  crossPostStrategy: z.string().min(1),
})

// ── FacebookContentPackage (output of facebook-creator) ─────────────────────

export const facebookContentPackageSchema = z.object({
  posts: z.array(facebookPostSchema).min(1),
  stories: z.array(facebookStorySchema),
  variations: z.array(facebookVariationSchema),
  metadata: facebookMetadataSchema,
  generatedBy: z.string(),
  campaignId: z.string(),
})

export type FacebookContentPackage = z.infer<typeof facebookContentPackageSchema>

// ── Sub-schemas for Instagram Content Package ────────────────────────────────

const instagramPostSchema = z.object({
  postId: z.string().min(1),
  caption: z.string().min(10),
  hashtags: z.array(z.string()).min(1),
  visualConcept: z.string().min(10),
  format: z.enum(['static', 'carousel', 'reel']),
  artDirection: z.string().min(5),
})

const instagramReelSchema = z.object({
  reelId: z.string().min(1),
  hook: z.string().min(5),
  script: z.string().min(10),
  musicSuggestion: z.string().min(1),
  visualDirections: z.string().min(10),
  duration: z.number().positive().max(90),
})

const instagramStoryFrameSchema = z.object({
  frameNumber: z.number().int().positive(),
  content: z.string().min(1),
  visualDescription: z.string().min(1),
  duration: z.number().positive(),
})

const instagramStorySchema = z.object({
  storyId: z.string().min(1),
  frames: z.array(instagramStoryFrameSchema).min(1),
  stickers: z.array(z.string()),
  interactions: z.array(z.string()),
})

const instagramCarouselSlideSchema = z.object({
  slideNumber: z.number().int().positive(),
  content: z.string().min(1),
  visualDescription: z.string().min(1),
})

const instagramCarouselSchema = z.object({
  carouselId: z.string().min(1),
  slides: z.array(instagramCarouselSlideSchema).min(2),
  swipeNarrative: z.string().min(5),
  coverSlide: z.string().min(5),
})

const instagramImagePromptSchema = z.object({
  postId: z.string().min(1),
  promptText: z.string().min(20),
  style: z.enum(['photography', 'illustration', '3d-render', 'graphic-design']),
  aspectRatio: z.enum(['1:1', '4:5', '9:16']),
  generator: z.enum(['flux', 'ideogram', 'gpt-image']),
})

const instagramVariationSchema = z.object({
  postId: z.string().min(1),
  altCaption: z.string().min(10),
  altVisual: z.string(),
  rationale: z.string().min(5),
})

const instagramPostingScheduleEntrySchema = z.object({
  contentId: z.string().min(1),
  date: z.string(),
  time: z.string(),
  timezone: z.string(),
})

const instagramMetadataSchema = z.object({
  postingSchedule: z.array(instagramPostingScheduleEntrySchema),
  hashtagStrategy: z.string().min(1),
  aestheticNotes: z.string().min(1),
})

// ── InstagramContentPackage (output of instagram-creator) ───────────────────

export const instagramContentPackageSchema = z.object({
  posts: z.array(instagramPostSchema).min(1),
  reels: z.array(instagramReelSchema),
  stories: z.array(instagramStorySchema),
  carousels: z.array(instagramCarouselSchema),
  imagePrompts: z.array(instagramImagePromptSchema),
  variations: z.array(instagramVariationSchema),
  metadata: instagramMetadataSchema,
  generatedBy: z.string(),
  campaignId: z.string(),
})

export type InstagramContentPackage = z.infer<typeof instagramContentPackageSchema>

// ── ContentItem (canonical content unit for downstream pipeline stages) ──────

export const contentItemSchema = z.object({
  itemId: z.string(),
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  contentType: z.string(),
  title: z.string(),
  body: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'review', 'approved', 'rejected', 'published']),
  generatedBy: z.string(),
  agentName: z.string(),
  campaignId: z.string(),
  createdAt: z.string(),
})

export type ContentItem = z.infer<typeof contentItemSchema>

// ── CreationInputs (typed inputs for creation agents) ────────────────────────

export const creationInputsSchema = z.object({
  campaignPlan: campaignPlanSchema,
  contentCalendar: contentCalendarSchema,
  channelOptimizationPlan: channelOptimizationPlanSchema,
  brandVoiceConfig: z.object({
    tone: z.string().min(1),
    communicationStyle: z.string().min(1),
    brandPrinciples: z.array(z.string().min(1)),
    bannedPhrases: z.array(z.string().min(1)),
    productName: z.string().optional(),
  }),
  trendBrief: z.object({
    trends: z.array(z.object({
      name: z.string(),
      platform: z.string(),
      description: z.string(),
    })),
    recommendations: z.string(),
  }).passthrough(),
})

export type CreationInputs = z.infer<typeof creationInputsSchema>

// ── CreationStageOutput (combined output of the creation stage) ──────────────

const stageMetadataSchema = z.object({
  agentsExecuted: z.array(z.string()),
  agentsSucceeded: z.array(z.string()),
  agentsFailed: z.array(z.string()),
  agentErrors: z.record(z.string(), z.string()).optional(),
})

export const creationStageOutputSchema = z.object({
  redditPackage: redditContentPackageSchema.nullable(),
  tiktokPackage: tiktokContentPackageSchema.nullable(),
  facebookPackage: facebookContentPackageSchema.nullable(),
  instagramPackage: instagramContentPackageSchema.nullable(),
  contentItems: z.array(contentItemSchema),
  stageMetadata: stageMetadataSchema,
})

export type CreationStageOutput = z.infer<typeof creationStageOutputSchema>
