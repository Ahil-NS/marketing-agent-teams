import {Args, Command, Flags} from '@oclif/core'
import {input} from '@inquirer/prompts'

import {ReviewQueue} from '../../lib/review-queue/index.js'
import type {ReviewItem} from '../../lib/review-queue/index.js'

export default class ReviewEdit extends Command {
  static override args = {
    id: Args.string({description: 'Review item ID to edit', required: true}),
  }

  static override description = 'Edit a content item and approve it'

  static enableJsonFlag = true

  static override flags = {
    notes: Flags.string({description: 'Edit rationale'}),
  }

  async run(): Promise<ReviewItem> {
    const {args, flags} = await this.parse(ReviewEdit)
    const projectRoot = process.cwd()
    const queue = new ReviewQueue(projectRoot)
    const current = await queue.getById(args.id)

    // Present current editable content fields
    this.log(`\nEditing item: ${current.id}`)
    this.log(`Platform: ${current.platform}`)
    this.log('─'.repeat(40))

    const edits: Record<string, string> = {}

    // Edit title if present
    if (current.content.title !== undefined) {
      this.log(`\nCurrent title: ${current.content.title}`)
      const newTitle = await input({
        default: current.content.title,
        message: 'Title (press Enter to keep current):',
      })
      if (newTitle !== current.content.title) {
        edits.title = newTitle
      }
    }

    // Edit body
    this.log(`\nCurrent body:\n${current.content.body}`)
    const newBody = await input({
      default: current.content.body,
      message: 'Body (press Enter to keep current):',
    })
    if (newBody !== current.content.body) {
      edits.body = newBody
    }

    // Edit CTA if present
    if (current.content.cta !== undefined) {
      this.log(`\nCurrent CTA: ${current.content.cta}`)
      const newCta = await input({
        default: current.content.cta,
        message: 'CTA (press Enter to keep current):',
      })
      if (newCta !== current.content.cta) {
        edits.cta = newCta
      }
    }

    if (Object.keys(edits).length === 0) {
      this.log('\nNo changes made.')
      return current
    }

    // Show diff
    this.log('\nChanges:')
    for (const [field, newValue] of Object.entries(edits)) {
      const original = (current.content as unknown as Record<string, unknown>)[field]
      this.log(`  ${field}: "${String(original)}" → "${newValue}"`)
    }

    const item = await queue.edit(args.id, edits, flags.notes)
    this.log(`\nEdited and approved item ${item.id}`)
    return item
  }
}
