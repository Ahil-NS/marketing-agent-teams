import {z} from 'zod'

import type {PlatformName} from '../types.js'

// --- Zod Schemas ---

export const scheduleSlotSchema = z.object({
  dayOfWeek: z.array(z.number().int().min(0).max(6)),
  hourUtc: z.number().int().min(0).max(23),
  label: z.string().optional(),
  score: z.number().optional(),
})

export const platformScheduleConfigSchema = z.object({
  preferredSlots: z.array(scheduleSlotSchema),
  minGapMinutes: z.number().int().min(1).default(30),
})

export const scheduleOptionsSchema = z.object({
  publishNow: z.boolean().default(false),
  minGapMinutes: z.number().int().min(1).optional(),
})

// --- Inferred Types ---

export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>
export type PlatformScheduleConfig = z.infer<typeof platformScheduleConfigSchema>
export type ScheduleOptions = z.infer<typeof scheduleOptionsSchema>

// --- Additional Types ---

export interface ScheduleResult {
  scheduled: ScheduledItem[]
  skipped: SkippedItem[]
}

export interface ScheduledItem {
  itemId: string
  platform: PlatformName
  scheduledTime: string
  source: 'engagement' | 'default' | 'immediate'
}

export interface SkippedItem {
  itemId: string
  platform: PlatformName
  reason: string
}

export interface ScheduleStatus {
  nextPublishAt: string | null
  byPlatform: Partial<Record<PlatformName, {queued: number; nextAt: string | null}>>
  upcomingItems: ScheduledItemSummary[]
}

export interface ScheduledItemSummary {
  itemId: string
  platform: PlatformName
  scheduledTime: string
}

// --- Default Platform Schedules ---

export const DEFAULT_PLATFORM_SCHEDULE: Record<PlatformName, PlatformScheduleConfig> = {
  reddit: {
    preferredSlots: [
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 14, label: 'Weekday morning EST'},
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 23, label: 'Weekday evening EST'},
    ],
    minGapMinutes: 30,
  },
  tiktok: {
    preferredSlots: [
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 0, label: 'Weekday evening EST'},
      {dayOfWeek: [0, 6], hourUtc: 15, label: 'Weekend morning EST'},
    ],
    minGapMinutes: 60,
  },
  facebook: {
    preferredSlots: [
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 14, label: 'Weekday morning EST'},
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 18, label: 'Weekday afternoon EST'},
    ],
    minGapMinutes: 30,
  },
  instagram: {
    preferredSlots: [
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 15, label: 'Weekday late morning EST'},
      {dayOfWeek: [1, 2, 3, 4, 5], hourUtc: 0, label: 'Weekday evening EST'},
    ],
    minGapMinutes: 30,
  },
}
