import type {Command} from '@oclif/core'

import type {ReviewItem, ReviewQueueStats} from './types.js'

/** Platform display labels with icons */
const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  instagram: 'Instagram',
}

/** Content type abbreviated tags (only shown for non-standard) */
const CONTENT_TYPE_TAGS: Record<string, string> = {
  'trending-derivative': 'trending',
  'retry': 'retry',
  'compliance-flagged': 'flagged',
}

const MAX_PREVIEW_LENGTH = 50
const SEPARATOR = '─'.repeat(60)

/**
 * Renders review queue items as formatted CLI output.
 * Groups items by platform and displays quality indicators.
 */
export class ContentRenderer {
  /**
   * Render the full queue table grouped by platform.
   */
  static renderQueueTable(cmd: Command, items: ReviewItem[]): void {
    const grouped = ContentRenderer.groupByPlatform(items)
    const flaggedCount = items.filter((item) => item.complianceFlags.length > 0).length

    cmd.log(`\n=== Review Queue (${items.length} items) ===\n`)

    for (const [platform, platformItems] of Object.entries(grouped)) {
      const label = PLATFORM_LABELS[platform] ?? platform
      cmd.log(`${label} (${platformItems.length} items)`)
      cmd.log(SEPARATOR)
      cmd.log(ContentRenderer.formatHeader())

      for (const item of platformItems) {
        cmd.log(ContentRenderer.formatRow(item))
      }

      cmd.log('')
    }

    if (flaggedCount > 0) {
      cmd.log(`Compliance flags: ${flaggedCount} items flagged`)
    }

    cmd.log(`Run 'mat review show <id>' to see full platform preview`)
    cmd.log(`Run 'mat review approve <id>' to approve items`)
  }

  /**
   * Render an empty queue message with guidance.
   */
  static renderEmptyState(cmd: Command): void {
    cmd.log('\nReview queue is empty.\n')
    cmd.log('No content items are waiting for review.')
    cmd.log(`Run 'mat run' to generate content first.\n`)
  }

  /**
   * Render queue statistics summary.
   */
  static renderStats(cmd: Command, stats: ReviewQueueStats): void {
    cmd.log(`\nQueue Stats: ${stats.total} total`)
    cmd.log(`  Pending:  ${stats.pending}`)
    cmd.log(`  Approved: ${stats.approved}`)
    cmd.log(`  Edited:   ${stats.edited}`)
    cmd.log(`  Rejected: ${stats.rejected}`)
  }

  /** Group items by platform preserving sort order */
  private static groupByPlatform(items: ReviewItem[]): Record<string, ReviewItem[]> {
    const grouped: Record<string, ReviewItem[]> = {}
    for (const item of items) {
      if (!grouped[item.platform]) {
        grouped[item.platform] = []
      }

      grouped[item.platform].push(item)
    }

    return grouped
  }

  /** Format the table header row */
  private static formatHeader(): string {
    return ` ${'ID'.padEnd(16)} ${'Status'.padEnd(10)} ${'Score'.padEnd(6)} ${'Type'.padEnd(10)} Preview`
  }

  /** Format a single item row */
  private static formatRow(item: ReviewItem): string {
    const id = item.id.padEnd(16)
    const status = item.status.padEnd(10)
    const score = item.qualityScore.toFixed(2).padEnd(6)
    const typeTag = CONTENT_TYPE_TAGS[item.contentType] ?? ''
    const type = typeTag.padEnd(10)
    const preview = ContentRenderer.truncate(item.content.title ?? item.content.body)
    return ` ${id} ${status} ${score} ${type} ${preview}`
  }

  /** Truncate text to MAX_PREVIEW_LENGTH, appending "..." if needed */
  private static truncate(text: string): string {
    if (text.length <= MAX_PREVIEW_LENGTH) {
      return text
    }

    return text.slice(0, MAX_PREVIEW_LENGTH - 3) + '...'
  }
}
