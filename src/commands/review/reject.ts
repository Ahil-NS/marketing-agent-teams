import {Args, Command, Flags} from '@oclif/core'

import {ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewItem} from '../../lib/review-queue/index.js'

export default class ReviewReject extends Command {
  static override args = {
    id: Args.string({description: 'Review item ID to reject', required: true}),
  }

  static override description = 'Reject a content item with a reason'

  static enableJsonFlag = true

  static override flags = {
    feedback: Flags.string({description: 'Actionable guidance for improvement'}),
    reason: Flags.string({description: 'Rejection reason', required: true}),
  }

  async run(): Promise<ReviewItem> {
    const {args, flags} = await this.parse(ReviewReject)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)
    const item = await queue.reject(args.id, flags.reason, flags.feedback)
    this.log(`Rejected item ${item.id} — reason: ${flags.reason}`)
    return item
  }
}
