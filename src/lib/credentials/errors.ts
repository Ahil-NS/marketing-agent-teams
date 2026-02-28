import { MATError } from '../utils/errors.js'

export const CREDENTIAL_NOT_FOUND = 'CREDENTIAL_NOT_FOUND'
export const CREDENTIAL_STORE_FAILED = 'CREDENTIAL_STORE_FAILED'
export const CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED'
export const CREDENTIAL_KEYCHAIN_UNAVAILABLE = 'CREDENTIAL_KEYCHAIN_UNAVAILABLE'

export class CredentialNotFoundError extends MATError {
  constructor(platform: string) {
    super(
      `No credential found for platform: ${platform}`,
      CREDENTIAL_NOT_FOUND,
      `No stored credential exists for "${platform}". The platform may not have been connected yet.`,
      `Run "mat config platforms add ${platform}" to connect the platform.`,
      'credentials',
      'permanent',
    )
  }
}

export class CredentialStoreError extends MATError {
  constructor(platform: string, detail: string) {
    super(
      `Failed to store credential for platform: ${platform}`,
      CREDENTIAL_STORE_FAILED,
      `OS keychain write failed for "${platform}": ${detail}`,
      'Ensure your OS keychain (macOS Keychain / Linux secret-service) is unlocked and accessible.',
      'credentials',
      'transient',
    )
  }
}

export class CredentialExpiredError extends MATError {
  constructor(platform: string) {
    super(
      `Credential expired for platform: ${platform}`,
      CREDENTIAL_EXPIRED,
      `The OAuth token for "${platform}" has expired and needs to be refreshed.`,
      `Run "mat config platforms add ${platform}" to re-authenticate.`,
      'credentials',
      'transient',
    )
  }
}

export class KeychainUnavailableError extends MATError {
  constructor(detail: string) {
    super(
      'OS keychain is not available',
      CREDENTIAL_KEYCHAIN_UNAVAILABLE,
      `Cannot access OS credential storage: ${detail}`,
      'Ensure macOS Keychain or Linux secret-service (libsecret) is available and unlocked.',
      'credentials',
      'permanent',
    )
  }
}

export const CREDENTIAL_TRUST_VIOLATION = 'CREDENTIAL_TRUST_VIOLATION'
export const CREDENTIAL_ACCESS_DENIED = 'CREDENTIAL_ACCESS_DENIED'

export class TrustViolationError extends MATError {
  constructor(agentName: string, attempted: string, declared: string[]) {
    super(
      `Agent '${agentName}' attempted to access '${attempted}' but only declares: [${declared.join(', ')}]`,
      CREDENTIAL_TRUST_VIOLATION,
      `Agent '${agentName}' attempted to access '${attempted}' but only declares: [${declared.join(', ')}]`,
      `Update the agent's SKILL.md permissions.credentials to include '${attempted}', or remove the credential request`,
      'credentials',
      'permanent',
    )
  }
}

export class CredentialAccessDeniedError extends MATError {
  constructor(agentName: string, trustTier: string) {
    super(
      `Agent '${agentName}' at trust tier '${trustTier}' is not permitted to access credentials`,
      CREDENTIAL_ACCESS_DENIED,
      `Agent '${agentName}' at trust tier '${trustTier}' is not permitted to access credentials`,
      `Promote the agent to 'verified' tier: mat agents trust ${agentName} verified`,
      'credentials',
      'permanent',
    )
  }
}
