import {z} from 'zod'

import {
  trendBriefSchema,
  competitorReportSchema,
  viralPatternReportSchema,
  platformAlgorithmReportSchema,
} from './agent-schema.js'

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const contentThemeSchema = z.object({
  theme: z.string(),
  rationale: z.string(),
  contentTypes: z.array(z.string()),
  platformFit: z.record(z.string(), z.number().min(0).max(1)),
})

const successMetricSchema = z.object({
  metric: z.string(),
  target: z.number().positive(),
  platform: z.string().optional(),
})

const seasonalOpportunitySchema = z.object({
  date: z.string(),
  eventName: z.string(),
  relevantThemes: z.array(z.string()),
  suggestedContentTypes: z.array(z.string()),
  platformRecommendations: z.array(z.string()),
  estimatedImpact: z.enum(['high', 'medium', 'low']),
})

// ── CampaignPlan (output of content-strategist) ─────────────────────────────

export const campaignPlanSchema = z.object({
  planId: z.string(),
  campaignName: z.string().min(3).max(100),
  objective: z.string().min(10).max(500),
  targetAudience: z.string().min(5).max(200),
  contentThemes: z.array(contentThemeSchema).min(1).max(7),
  timeline: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  successMetrics: z.array(successMetricSchema).min(1),
  budget: z.object({
    estimatedCost: z.number().nonnegative(),
    optimizations: z.array(z.string()),
  }),
  researchInsights: z.object({
    trendSummary: z.string(),
    competitorInsights: z.string(),
    opportunityStatement: z.string(),
  }),
  createdAt: z.string(),
  createdBy: z.string(),
})

export type CampaignPlan = z.infer<typeof campaignPlanSchema>

// ── ContentCalendar (output of campaign-planner) ─────────────────────────────

const contentCalendarEntrySchema = z.object({
  date: z.string(),
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  contentType: z.enum([
    'promotional',
    'educational',
    'engagement',
    'seasonal',
    'thought-leadership',
    'community',
    'behind-the-scenes',
  ]),
  theme: z.string(),
  contentDescription: z.string(),
  estimatedEngagement: z.object({
    reach: z.number().nonnegative(),
    engagementRate: z.number().min(0).max(1),
  }),
  hashtags: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
  notes: z.string().optional(),
})

export const contentCalendarSchema = z.object({
  calendarId: z.string(),
  campaignId: z.string(),
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    duration: z.enum(['weekly', '14-day', 'monthly']),
  }),
  entries: z.array(contentCalendarEntrySchema).min(1),
  platformBalance: z.record(z.string(), z.number().min(0).max(1)),
  contentTypeBalance: z.record(z.string(), z.number().min(0).max(1)),
  seasonalEvents: z.array(seasonalOpportunitySchema),
  notes: z.string(),
  lastUpdated: z.string(),
})

export type ContentCalendar = z.infer<typeof contentCalendarSchema>

// ── ChannelOptimizationPlan (output of channel-optimizer) ────────────────────

const platformRecommendationSchema = z.object({
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  optimalPostingTimes: z.array(
    z.object({
      day: z.string(),
      hours: z.array(z.string()),
      timezone: z.string(),
      rationale: z.string(),
    }),
  ),
  contentFormatPreferences: z.array(
    z.object({
      format: z.string(),
      algorithmBoost: z.enum(['strong', 'moderate', 'neutral', 'penalized']),
      recommendation: z.string(),
    }),
  ),
  antiPatterns: z.array(
    z.object({
      pattern: z.string(),
      risk: z.string(),
      avoidance: z.string(),
    }),
  ),
  optimizationNotes: z.string(),
})

export const channelOptimizationPlanSchema = z.object({
  planId: z.string(),
  campaignId: z.string(),
  perPlatformRecommendations: z.array(platformRecommendationSchema).min(1),
  seasonalOpportunities: z.array(seasonalOpportunitySchema),
  crossPlatformStrategies: z.array(
    z.object({
      strategy: z.string(),
      description: z.string(),
      platforms: z.array(z.string()),
      expectedImpact: z.enum(['high', 'medium', 'low']),
    }),
  ),
  recommendations: z.string(),
  generatedAt: z.string(),
})

export type ChannelOptimizationPlan = z.infer<typeof channelOptimizationPlanSchema>

// ── Input schemas for strategy agents ────────────────────────────────────────

export const strategyInputsSchema = z.object({
  trendBrief: trendBriefSchema,
  competitorReport: competitorReportSchema,
  viralPatternReport: viralPatternReportSchema,
  platformAlgorithmReport: platformAlgorithmReportSchema,
  brandVoiceConfig: z.object({
    tone: z.string(),
    communicationStyle: z.string(),
    brandPrinciples: z.array(z.string()),
    bannedPhrases: z.array(z.string()),
    productName: z.string().optional(),
  }),
  platforms: z.array(z.enum(['reddit', 'tiktok', 'facebook', 'instagram'])).min(1),
})

export type StrategyInputs = z.infer<typeof strategyInputsSchema>

export const calendarInputsSchema = z.object({
  campaignPlan: campaignPlanSchema,
  brandVoiceConfig: z.object({
    tone: z.string(),
    communicationStyle: z.string(),
  }),
  calendarDuration: z.enum(['weekly', '14-day', 'monthly']).optional(),
})

export type CalendarInputs = z.infer<typeof calendarInputsSchema>

export const optimizerInputsSchema = z.object({
  campaignPlan: campaignPlanSchema,
  contentCalendar: contentCalendarSchema,
  platformAlgorithmReport: platformAlgorithmReportSchema,
})

export type OptimizerInputs = z.infer<typeof optimizerInputsSchema>
