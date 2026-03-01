import {z} from 'zod'

import type {PlatformName} from '../platforms/types.js'

// ── Viral Threshold Configuration ────────────────────────────────────────────

export const viralThresholdConfigSchema = z.object({
  engagementRate: z.number().min(0).max(1).optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
})

export type ViralThresholdConfig = z.infer<typeof viralThresholdConfigSchema>

// ── Viral Detection Result ───────────────────────────────────────────────────

export interface ViralDetectionResult {
  postId: string
  platform: PlatformName
  metrics: {
    postId: string
    platform: PlatformName
    views?: number
    likes?: number
    comments?: number
    shares?: number
    engagementRate?: number
    retrievedAt: string
  }
  exceededThresholds: string[]
  detectedAt: string // ISO 8601
}

// ── Derivative Task ──────────────────────────────────────────────────────────

export type DerivationType = 'repurpose' | 'variation' | 'thread-expansion'

export interface DerivativeTask {
  taskId: string
  sourcePostId: string
  sourcePlatform: PlatformName
  sourceEngagement: {
    postId: string
    platform: PlatformName
    views?: number
    likes?: number
    comments?: number
    shares?: number
    engagementRate?: number
    retrievedAt: string
  }
  targetPlatforms: PlatformName[]
  derivationType: DerivationType
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string // ISO 8601
}

// ── Derivative Metadata (tags derivative content in the review queue) ────────

export interface DerivativeMetadata {
  tag: 'trending-derivative'
  sourcePostId: string
  sourcePlatform: PlatformName
  sourceEngagement: {
    postId: string
    platform: PlatformName
    views?: number
    likes?: number
    comments?: number
    shares?: number
    engagementRate?: number
    retrievedAt: string
  }
  derivationType: DerivationType
}

// ── Default Viral Thresholds per Platform ────────────────────────────────────

export const DEFAULT_VIRAL_THRESHOLDS: Record<PlatformName, ViralThresholdConfig> = {
  reddit: {engagementRate: 0.05, likes: 500, comments: 100},
  tiktok: {views: 10_000, likes: 1000, shares: 200},
  facebook: {engagementRate: 0.03, shares: 100, comments: 50},
  instagram: {engagementRate: 0.05, likes: 1000, comments: 100},
}

// ── Viral Tracking State (deduplication persistence) ─────────────────────────

export const viralTrackingEntrySchema = z.object({
  detectedAt: z.string().min(1),
  derivativeTaskId: z.string().min(1),
})

export const viralTrackingStateSchema = z.object({
  processedPosts: z.record(z.string(), viralTrackingEntrySchema),
})

export type ViralTrackingState = z.infer<typeof viralTrackingStateSchema>
