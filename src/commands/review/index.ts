import {writeFile} from 'node:fs/promises'

import {Command, Flags} from '@oclif/core'

import {ContentRenderer} from '../../lib/review-queue/content-renderer.js'
import {exportToCSV, exportToJSON, ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewFilter, ReviewItem} from '../../lib/review-queue/index.js'

export default class Review extends Command {
  static override description = 'View content review queue'

  static enableJsonFlag = true

  static override flags = {
    'export': Flags.string({
      description: 'Export format (json or csv)',
      options: ['json', 'csv'],
    }),
    'output': Flags.string({
      description: 'Output file path (defaults to stdout)',
    }),
    'platform': Flags.string({
      description: 'Filter by platform',
      options: ['reddit', 'tiktok', 'facebook', 'instagram'],
    }),
    'quality-above': Flags.integer({
      description: 'Min quality score (0-100)',
    }),
    'run-id': Flags.string({description: 'Filter by pipeline run ID'}),
    'status': Flags.string({
      description: 'Filter by review status',
      options: ['pending', 'approved', 'edited', 'rejected'],
    }),
    'type': Flags.string({
      description: 'Filter by content type',
      options: ['standard', 'trending-derivative', 'retry', 'compliance-flagged'],
    }),
  }

  async run(): Promise<ReviewItem[]> {
    const {flags} = await this.parse(Review)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)

    const filter: ReviewFilter = {}
    if (flags.platform) filter.platform = flags.platform as ReviewFilter['platform']
    if (flags['quality-above'] !== undefined) filter.qualityAbove = flags['quality-above'] / 100
    if (flags['run-id']) filter.runId = flags['run-id']
    if (flags.status) filter.status = flags.status as ReviewFilter['status']
    if (flags.type) filter.contentType = flags.type as ReviewFilter['contentType']

    const hasFilter = Object.keys(filter).length > 0
    const items = await queue.list(hasFilter ? filter : undefined)

    // Handle export mode
    if (flags.export) {
      const output = flags.export === 'json' ? exportToJSON(items) : exportToCSV(items)

      if (flags.output) {
        await writeFile(flags.output, output, 'utf-8')
        this.log(`Exported ${items.length} items to ${flags.output}`)
      } else {
        this.log(output)
      }

      return items
    }

    if (items.length === 0) {
      ContentRenderer.renderEmptyState(this)
      return []
    }

    if (hasFilter) {
      const allItems = await queue.list()
      this.log(`Showing ${items.length} of ${allItems.length} items (filtered)`)
    }

    ContentRenderer.renderQueueTable(this, items)
    return items
  }
}
