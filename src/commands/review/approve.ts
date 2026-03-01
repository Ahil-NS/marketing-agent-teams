import {Args, Command, Flags} from '@oclif/core'

import {ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewItem} from '../../lib/review-queue/index.js'

export default class ReviewApprove extends Command {
  static override args = {
    id: Args.string({description: 'Review item ID to approve', required: true}),
  }

  static override description = 'Approve a content item for distribution'

  static enableJsonFlag = true

  static override flags = {
    notes: Flags.string({description: 'Approval notes'}),
  }

  async run(): Promise<ReviewItem> {
    const {args, flags} = await this.parse(ReviewApprove)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)
    const item = await queue.approve(args.id, flags.notes)
    this.log(`Approved item ${item.id} — eligible for distribution`)
    return item
  }
}
