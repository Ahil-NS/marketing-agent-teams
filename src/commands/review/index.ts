import {Command, Flags} from '@oclif/core'

import {ContentRenderer} from '../../lib/review-queue/content-renderer.js'
import {ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewItem} from '../../lib/review-queue/index.js'

export default class Review extends Command {
  static override description = 'View content review queue'

  static enableJsonFlag = true

  static override flags = {
    'run-id': Flags.string({description: 'Filter by pipeline run ID'}),
  }

  async run(): Promise<ReviewItem[]> {
    const {flags} = await this.parse(Review)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)
    const items = await queue.list(flags['run-id'] ? {runId: flags['run-id']} : undefined)

    if (items.length === 0) {
      ContentRenderer.renderEmptyState(this)
      return []
    }

    ContentRenderer.renderQueueTable(this, items)
    return items
  }
}
