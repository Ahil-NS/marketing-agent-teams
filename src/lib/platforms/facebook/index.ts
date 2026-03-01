export {FacebookAdapter} from './facebook-adapter.js'
export type {FacebookAdapterOptions} from './facebook-adapter.js'
export {
  FacebookApiError,
  FacebookAuthError,
  FacebookTokenExchangeError,
  FacebookPublishError,
  FacebookPageNotFoundError,
  FacebookDuplicatePostError,
  classifyFacebookErrorCode,
  classifyHttpStatus,
} from './errors.js'
export {
  buildFacebookAuthorizationUrl,
  exchangeFacebookCode,
  exchangeForLongLivedToken,
  getPageAccessTokens,
  executeFacebookTokenChain,
} from './facebook-auth.js'
export type {
  FacebookTokenResponse,
  FacebookPage,
  FacebookMeAccounts,
  FacebookFeedPostResponse,
  FacebookPhotoUploadResponse,
  FacebookGraphError,
  FacebookPostMetrics,
  FacebookAppUsage,
  FacebookRateLimitState,
} from './facebook-types.js'
export {
  GRAPH_API_BASE,
  FACEBOOK_THROTTLE_THRESHOLD,
  FACEBOOK_PAGE_CALLS_PER_DAY,
  FACEBOOK_POST_MAX_LENGTH,
  FACEBOOK_ERROR_CLASSIFICATION,
  FACEBOOK_ERROR_RESOLUTIONS,
  facebookTokenResponseSchema,
  facebookPageSchema,
  facebookMeAccountsSchema,
  facebookFeedPostResponseSchema,
  facebookPhotoUploadResponseSchema,
  facebookGraphErrorSchema,
  facebookPostMetricsSchema,
  facebookAppUsageSchema,
} from './facebook-types.js'
