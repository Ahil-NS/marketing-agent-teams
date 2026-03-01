export {AdapterRegistry} from './adapter-registry.js'
export {
  PlatformNotRegisteredError,
  PlatformAuthError,
  ContentValidationFailedError,
  PlatformPublishFailedError,
  PlatformRateLimitError,
  PlatformTimeoutError,
  PlatformContentPolicyError,
  PlatformNetworkError,
} from './errors.js'
export {classifyError, classifyNetworkError} from './error-classifier.js'
export type {ErrorClassification, ErrorClassificationType} from './error-classifier.js'
export {RateLimitTracker} from './rate-limiter.js'
export type {QuotaCheck, RateLimitState, RateLimitTrackerOptions} from './rate-limiter.js'
export {createPlatformFetch} from './platform-fetch.js'
export type {CreatePlatformFetchOptions, PlatformFetchOptions, PlatformFetchResult} from './platform-fetch.js'
export {PLATFORM_CONSTRAINTS, validateContentForPlatform} from './content-validator.js'
export {RedditAdapter} from './reddit/index.js'
export type {RedditAdapterOptions} from './reddit/index.js'
export {TikTokAdapter} from './tiktok/index.js'
export type {TikTokAdapterOptions} from './tiktok/index.js'
export {FacebookAdapter} from './facebook/index.js'
export type {FacebookAdapterOptions} from './facebook/index.js'
export {InstagramAdapter} from './instagram/index.js'
export type {InstagramAdapterOptions} from './instagram/index.js'
export type {
  AuthResult,
  ContentValidationError,
  ContentValidationResult,
  ContentValidationWarning,
  MediaAttachment,
  PlatformAdapter,
  PlatformConstraints,
  PlatformContent,
  PlatformMetrics,
  PlatformName,
  PlatformPublishError,
  PublishResult,
  RateLimitStatus,
} from './types.js'
export {RetryQueue, RetryQueueError, RetryItemNotFoundError} from './retry-queue/index.js'
export type {RetryQueueOptions, RetryQueueItem, RetryQueueStatus, RetryProcessResult, RetryErrorDetail} from './retry-queue/index.js'
export {ContentScheduler, getScheduleStatus, TimingAnalyzer, MIN_DATA_POINTS, DEFAULT_PLATFORM_SCHEDULE, scheduleSlotSchema, platformScheduleConfigSchema, scheduleOptionsSchema} from './scheduler/index.js'
export type {ScheduleSlot, PlatformScheduleConfig, ScheduleOptions, ScheduleResult, ScheduledItem, SkippedItem, ScheduleStatus, ScheduledItemSummary} from './scheduler/index.js'
export {PlatformConnectionManager, PlatformConnectionNotFoundError, PlatformConnectionError} from './connection-manager.js'
export type {PlatformConnection, ConnectionStatus, TokenRefreshResult, ConnectionHealthResult, PlatformConnectionStatus} from './connection-manager.js'
export {TokenLifecycleManager, REFRESH_WINDOWS} from './token-lifecycle.js'
export type {ExpiringToken, TokenRefreshSummary} from './token-lifecycle.js'
