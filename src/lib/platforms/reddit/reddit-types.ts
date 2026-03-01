import {z} from 'zod'

// --- Reddit Submit API ---

export const redditSubmitDataSchema = z.object({
  url: z.string(),
  id: z.string(),
  name: z.string(), // fullname e.g. "t3_abc123"
})

export const redditSubmitResponseSchema = z.object({
  json: z.object({
    errors: z.array(z.array(z.string())), // [[code, message, field], ...]
    data: redditSubmitDataSchema.nullable().optional(),
  }),
})

export type RedditSubmitResponse = z.infer<typeof redditSubmitResponseSchema>

// --- Reddit Submit Parameters ---

export interface RedditSubmitParams {
  api_type: 'json'
  kind: 'self' | 'link'
  sr: string // subreddit name
  title: string
  text?: string // self-post body
  url?: string // link post URL
  flair_id?: string
  flair_text?: string
  nsfw?: boolean
  spoiler?: boolean
  sendreplies?: boolean
}

// --- Reddit Post Requirements ---

export const redditPostRequirementsSchema = z.object({
  is_flair_required: z.boolean().optional().default(false),
  title_text_min_length: z.number().optional().default(0),
  title_text_max_length: z.number().optional().default(300),
  body_restriction_policy: z.enum(['required', 'notAllowed', 'none']).optional().default('none'),
  body_blacklisted_strings: z.array(z.string()).optional().default([]),
  domain_blacklist: z.array(z.string()).optional().default([]),
  body_text_min_length: z.number().optional().default(0),
  body_text_max_length: z.number().optional().default(40_000),
})

export type RedditPostRequirements = z.infer<typeof redditPostRequirementsSchema>

// --- Reddit Flair Templates ---

export const redditFlairTemplateSchema = z.object({
  id: z.string(),
  text: z.string(),
  text_editable: z.boolean().optional().default(false),
  background_color: z.string().optional().default(''),
})

export const redditFlairTemplatesSchema = z.array(redditFlairTemplateSchema)

export type RedditFlairTemplate = z.infer<typeof redditFlairTemplateSchema>

// --- Reddit Rate Limit State ---

export const redditRateLimitStateSchema = z.object({
  remaining: z.number(),
  resetAt: z.number(), // epoch ms
  used: z.number().optional().default(0),
})

export type RedditRateLimitState = z.infer<typeof redditRateLimitStateSchema>

// --- Reddit Post Info (for metrics) ---

export const redditPostInfoSchema = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          score: z.number().optional().default(0),
          upvote_ratio: z.number().optional().default(0),
          num_comments: z.number().optional().default(0),
        }),
      }),
    ),
  }),
})

export type RedditPostInfo = z.infer<typeof redditPostInfoSchema>
