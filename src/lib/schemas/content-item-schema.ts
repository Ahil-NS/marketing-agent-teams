import {z} from 'zod'

import {attributionChainSchema} from './attribution-schema.js'

/**
 * Attribution metadata for a content item.
 * Tracks every AI model call that contributed to this content (FR28).
 */
export const contentItemAttributionSchema = z.object({
  /** Ordered list of all AI model calls that contributed to this content */
  attributionChain: attributionChainSchema,
})

export type ContentItemAttribution = z.infer<typeof contentItemAttributionSchema>
