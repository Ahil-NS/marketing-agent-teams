export { CredentialManager } from './credential-manager.js'
export { KeytarKeychainAdapter } from './keychain-adapter.js'
export { FileKeychainAdapter } from './file-keychain-adapter.js'
export { PlatformValidator } from './platform-validator.js'
export { OAuthFlowHandler } from './oauth-server.js'
export type { OAuthPlatformConfig } from './oauth-server.js'
export { getPlatformOAuthConfig, PLATFORM_OAUTH_DEFAULTS } from './platform-oauth-config.js'
export type {
  CredentialEntry,
  KeychainAdapter,
  Platform,
  PlatformCredential,
  TokenData,
  AuthResult,
} from './types.js'
export { SUPPORTED_PLATFORMS } from './types.js'
export {
  CredentialNotFoundError,
  CredentialStoreError,
  CredentialExpiredError,
  KeychainUnavailableError,
} from './errors.js'
