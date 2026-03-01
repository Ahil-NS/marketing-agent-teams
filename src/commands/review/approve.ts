import {Args, Command, Flags} from '@oclif/core'

import {ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewFilter, ReviewItem} from '../../lib/review-queue/index.js'

export default class ReviewApprove extends Command {
  static override args = {
    id: Args.string({description: 'Review item ID to approve (omit for bulk mode with filters)', required: false}),
  }

  static override description = 'Approve a content item for distribution'

  static enableJsonFlag = true

  static override flags = {
    'notes': Flags.string({description: 'Approval notes'}),
    'platform': Flags.string({
      description: 'Bulk filter by platform',
      options: ['reddit', 'tiktok', 'facebook', 'instagram'],
    }),
    'quality-above': Flags.integer({
      description: 'Bulk filter by min quality score (0-100)',
    }),
    'type': Flags.string({
      description: 'Bulk filter by content type',
      options: ['standard', 'trending-derivative', 'retry', 'compliance-flagged'],
    }),
    'yes': Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt for bulk approve',
      default: false,
    }),
  }

  async run(): Promise<ReviewItem | ReviewItem[]> {
    const {args, flags} = await this.parse(ReviewApprove)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)

    // Build filter from flags
    const filter: ReviewFilter = {}
    if (flags.platform) filter.platform = flags.platform as ReviewFilter['platform']
    if (flags['quality-above'] !== undefined) filter.qualityAbove = flags['quality-above'] / 100
    if (flags.type) filter.contentType = flags.type as ReviewFilter['contentType']

    const hasFilter = Object.keys(filter).length > 0

    // Single item mode
    if (args.id) {
      const item = await queue.approve(args.id, flags.notes)
      this.log(`Approved item ${item.id} — eligible for distribution`)
      return item
    }

    // Bulk mode requires at least one filter
    if (!hasFilter) {
      this.error('Provide an item ID or at least one filter flag (--platform, --quality-above, --type) for bulk approve')
    }

    // Preview matching items
    const pendingItems = await queue.list({...filter, status: 'pending'})

    if (pendingItems.length === 0) {
      this.log('No pending items match the filter')
      return []
    }

    // Confirm unless --yes
    if (!flags.yes) {
      const {confirm} = await import('@inquirer/prompts')
      try {
        const proceed = await confirm({message: `Approve ${pendingItems.length} items?`})
        if (!proceed) {
          this.log('Bulk approve cancelled')
          return []
        }
      } catch (error) {
        const {isExitPromptError} = await import('../../lib/utils/index.js')
        if (isExitPromptError(error)) {
          this.log('\nBulk approve cancelled')
          return []
        }

        throw error
      }
    }

    const approved = await queue.bulkApprove(filter)
    this.log(`Approved ${approved.length} items matching filter`)
    return approved
  }
}
