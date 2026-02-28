export const SUPPORTED_PLATFORMS = ['reddit', 'tiktok', 'facebook', 'instagram'] as const
export type Platform = (typeof SUPPORTED_PLATFORMS)[number]

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO 8601
}

export interface CredentialEntry {
  platform: Platform
  tokens: TokenData
}

export interface PlatformCredential {
  platform: Platform
  connected: boolean
  expiresAt?: string
  scopes: string[]
  connectedAt?: string
}

export interface AuthResult {
  success: boolean
  platform: Platform
  error?: string
}

export interface KeychainAdapter {
  setPassword(service: string, account: string, password: string): Promise<void>
  getPassword(service: string, account: string): Promise<string | null>
  deletePassword(service: string, account: string): Promise<boolean>
}

/**
 * Immutable map of platform credential key → token value.
 * Scoped per-agent by resolveForAgent(). Must never be serialized to disk or logs.
 */
export type CredentialContext = ReadonlyMap<string, string>

export type TrustTier = 'builtin' | 'verified' | 'community'

export interface PlatformCredentialMetadata {
  connectedAt: string
  expiresAt: string
  scopes: string[]
}
