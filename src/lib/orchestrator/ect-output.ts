import {z} from 'zod'

export const tiktokMetadataBundleSchema = z.object({
  title: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  keywords: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
    longTail: z.array(z.string()),
  }),
  onScreenTextSuggestions: z.array(z.string()),
  audioKeywords: z.array(z.string()),
  timing: z.object({
    bestDay: z.string(),
    bestTime: z.string(),
    timezone: z.string(),
    rationale: z.string(),
  }),
  trendingSounds: z.array(z.object({
    name: z.string(),
    relevance: z.string(),
  })),
  seoScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
})

export type TikTokMetadataBundle = z.infer<typeof tiktokMetadataBundleSchema>
