import {MATError} from '../utils/errors.js'

/**
 * Thrown when a review item is not found in the queue.
 */
export class ReviewItemNotFoundError extends MATError {
  constructor(itemId: string) {
    super(
      `Review item '${itemId}' not found`,
      'REVIEW_ITEM_NOT_FOUND',
      `No review item with ID '${itemId}' exists in the queue`,
      `Check available items with 'mat review'`,
      'review-queue',
      'permanent',
    )
  }
}

/**
 * Thrown when the review queue is empty.
 */
export class ReviewQueueEmptyError extends MATError {
  constructor() {
    super(
      'Review queue is empty',
      'REVIEW_QUEUE_EMPTY',
      'No content items are waiting for review',
      `Run 'mat run' to generate content first`,
      'review-queue',
      'permanent',
    )
  }
}
