export {AdapterRegistry} from './adapter-registry.js'
export {
  PlatformNotRegisteredError,
  PlatformAuthError,
  ContentValidationFailedError,
  PlatformPublishFailedError,
  PlatformRateLimitError,
} from './errors.js'
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
