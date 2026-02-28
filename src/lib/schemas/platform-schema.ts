import { z } from 'zod'

export const platformCredentialSchema = z.object({
  platform: z.enum(['reddit', 'tiktok', 'facebook', 'instagram']),
  connected: z.boolean(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).default([]),
  connectedAt: z.string().datetime().optional(),
})

export const platformsMetadataSchema = z.object({
  platforms: z.array(platformCredentialSchema).default([]),
})

export type PlatformCredentialMetadata = z.infer<typeof platformCredentialSchema>
export type PlatformsMetadata = z.infer<typeof platformsMetadataSchema>
