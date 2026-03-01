/**
 * Review queue export utilities.
 * Converts ReviewItem arrays to JSON or CSV format for external analysis/integration.
 */

import type {ReviewItem} from './types.js'

/**
 * Export review items as a pretty-printed JSON array.
 * Serializes all fields including content, metadata, quality scores, and status.
 */
export function exportToJSON(items: ReviewItem[]): string {
  return JSON.stringify(items, null, 2)
}

/**
 * Export review items as CSV with key fields.
 * Headers: id, platform, status, qualityScore, contentPreview, contentType, scheduledTime, generatedBy
 *
 * CSV field rules:
 * - qualityScore: displayed as 0-100 integer (internal 0-1 multiplied by 100, rounded)
 * - contentPreview: truncated to 80 chars, escaped per RFC 4180
 * - scheduledTime: ISO 8601 or empty if not set
 * - All string fields with commas, quotes, or newlines: wrapped in double quotes per RFC 4180
 */
export function exportToCSV(items: ReviewItem[]): string {
  const headers = 'id,platform,status,qualityScore,contentPreview,contentType,scheduledTime,generatedBy'
  const rows = items.map((item) =>
    [
      item.id,
      item.platform,
      item.status,
      Math.round(item.qualityScore * 100),
      csvEscape(truncate(item.content.body, 80)),
      item.contentType,
      item.scheduledTime ?? '',
      item.generatedBy,
    ].join(','),
  )
  return [headers, ...rows].join('\n')
}

/**
 * Escape a string value for CSV output per RFC 4180.
 * If the value contains commas, double quotes, or newlines,
 * wrap in double quotes and escape inner quotes by doubling them.
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

/**
 * Truncate a string to maxLength characters, adding '...' suffix if truncated.
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text
}
