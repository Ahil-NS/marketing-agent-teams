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
