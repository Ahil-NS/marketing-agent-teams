/**
 * Review queue types for managing pipeline-generated content review.
 * Used by ReviewQueue module and CLI review commands.
 */

export type ReviewStatus = 'pending' | 'approved' | 'edited' | 'rejected'

export type ContentType = 'standard' | 'trending-derivative' | 'retry' | 'compliance-flagged'

export type Platform = 'reddit' | 'tiktok' | 'facebook' | 'instagram'

export interface ReviewItemContent {
  title?: string
  body: string
  hashtags?: string[]
  hooks?: string[]
  cta?: string
  platformMeta: Record<string, unknown>
}

export interface UserFeedback {
  decision: ReviewStatus
  reason?: string
  notes?: string
  editedAt?: string
}

export interface EditHistoryEntry {
  timestamp: string
  field: string
  originalValue: string
  newValue: string
}

export interface ReviewItem {
  id: string
  runId: string
  platform: Platform
  status: ReviewStatus
  content: ReviewItemContent
  qualityScore: number
  complianceFlags: string[]
  contentType: ContentType
  generatedBy: string
  generatedAt: string
  scheduledTime?: string
  userFeedback?: UserFeedback
  editHistory: EditHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface ReviewFilter {
  platform?: Platform
  status?: ReviewStatus
  contentType?: ContentType
  runId?: string
}

export interface ReviewQueueStats {
  pending: number
  approved: number
  edited: number
  rejected: number
  total: number
}
