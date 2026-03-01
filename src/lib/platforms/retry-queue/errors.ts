import {MATError} from '../../utils/errors.js'

export class RetryQueueError extends MATError {
  constructor(message: string, detail: string) {
    super(
      message,
      'RETRY_QUEUE_ERROR',
      detail,
      'Check retry queue state in .mat/state/retry-queue/ and retry',
      'retry-queue',
      'transient',
    )
  }
}

export class RetryItemNotFoundError extends MATError {
  constructor(itemId: string) {
    super(
      `Retry queue item '${itemId}' not found`,
      'RETRY_ITEM_NOT_FOUND',
      `No item with ID '${itemId}' exists in the retry queue`,
      `Check item ID or run 'mat status' to see current retry queue`,
      'retry-queue',
      'permanent',
    )
  }
}
