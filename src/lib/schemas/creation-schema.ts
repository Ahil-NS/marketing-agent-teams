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
})

export const creationStageOutputSchema = z.object({
  redditPackage: redditContentPackageSchema.nullable(),
  tiktokPackage: tiktokContentPackageSchema.nullable(),
  contentItems: z.array(contentItemSchema),
  stageMetadata: stageMetadataSchema,
})

export type CreationStageOutput = z.infer<typeof creationStageOutputSchema>
