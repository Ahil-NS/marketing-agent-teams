import {z} from 'zod'

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const segmentDemographicsSchema = z.object({
  ageRange: z.string(),
  gender: z.string(),
  location: z.string(),
  income: z.string(),
  education: z.string(),
  profession: z.string(),
})

const segmentPsychographicsSchema = z.object({
  values: z.array(z.string()).min(1),
  lifestyle: z.string(),
  motivations: z.array(z.string()).min(1),
  valsType: z.string(),
})

const audienceSegmentSchema = z.object({
  segmentName: z.string().min(1),
  size: z.string().min(1),
  demographics: segmentDemographicsSchema,
  psychographics: segmentPsychographicsSchema,
  primaryPlatforms: z.array(z.string()).min(1),
  contentFormats: z.array(z.string()).min(1),
  engagementPatterns: z.string(),
})

const painPointSchema = z.object({
  painPoint: z.string().min(1),
  severity: z.enum(['high', 'medium', 'low']),
  segments: z.array(z.string()).min(1),
  contentOpportunity: z.string(),
})

const contentPreferenceSchema = z.object({
  format: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  segments: z.array(z.string()).min(1),
  engagementLevel: z.enum(['high', 'medium', 'low']),
})

const platformUsageSchema = z.object({
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  audienceSize: z.string(),
  primarySegments: z.array(z.string()).min(1),
  usagePattern: z.string(),
  peakActivity: z.string(),
  contentPreferences: z.array(z.string()).min(1),
})

const personaSchema = z.object({
  name: z.string().min(1),
  ageRange: z.string(),
  segment: z.string(),
  demographics: z.string(),
  psychographicProfile: z.string(),
  primaryPlatforms: z.array(z.string()).min(1),
  contentPreferences: z.array(z.string()).min(1),
  painPoints: z.array(z.string()).min(1),
  behavioralIndicators: z.array(z.string()).min(3),
  messagingAngle: z.string(),
})

// ── AudienceProfile (output of audience-researcher) ─────────────────────────

export const audienceProfileSchema = z.object({
  profileId: z.string().min(1),
  brandName: z.string().min(1),
  segments: z.array(audienceSegmentSchema).min(2),
  demographics: z.object({
    primaryAge: z.string(),
    genderSplit: z.string(),
    topLocations: z.array(z.string()).min(1),
    incomeRange: z.string(),
  }),
  psychographics: z.object({
    coreValues: z.array(z.string()).min(1),
    sharedMotivations: z.array(z.string()).min(1),
    dominantValsTypes: z.array(z.string()).min(1),
  }),
  painPoints: z.array(painPointSchema).min(1),
  contentPreferences: z.array(contentPreferenceSchema).min(1),
  platformUsage: z.array(platformUsageSchema).min(1),
  personas: z.array(personaSchema).min(1),
})

export type AudienceProfile = z.infer<typeof audienceProfileSchema>

// ── ChannelScore (enhanced output of channel-optimizer with audience data) ──

export const platformScoreSchema = z.object({
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  fitScore: z.number().min(0).max(1),
  audienceOverlap: z.number().min(0).max(1),
  engagementPotential: z.number().min(0).max(1),
  recommendedFormats: z.array(z.string()).min(1),
  priority: z.enum(['primary', 'secondary', 'experimental', 'not-recommended']),
})

export const postingFrequencySchema = z.object({
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  recommended: z.string().min(1),
  minimum: z.string().min(1),
  maximum: z.string().min(1),
  rationale: z.string(),
})

export const contentFormatRecommendationSchema = z.object({
  format: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  audienceSegments: z.array(z.string()).min(1),
  expectedEngagement: z.enum(['high', 'medium', 'low']),
  rationale: z.string(),
})

export const channelScoreSchema = z.object({
  scoreId: z.string().min(1),
  audienceProfileId: z.string().min(1),
  platformScores: z.array(platformScoreSchema).min(1),
  recommendations: z.array(z.string()).min(1),
  postingFrequency: z.array(postingFrequencySchema).min(1),
  contentFormatRecommendations: z.array(contentFormatRecommendationSchema).min(1),
  crossPlatformStrategy: z.string().min(1),
})

export type ChannelScore = z.infer<typeof channelScoreSchema>

// ── Input schemas ────────────────────────────────────────────────────────────

export const audienceResearchInputsSchema = z.object({
  brandConfig: z.object({
    brandName: z.string().min(1),
    productDomain: z.string().min(1),
    tone: z.string().optional(),
    communicationStyle: z.string().optional(),
    productName: z.string().optional(),
  }),
  verticalContext: z.string().optional(),
  competitorData: z.string().optional(),
})

export type AudienceResearchInputs = z.infer<typeof audienceResearchInputsSchema>
