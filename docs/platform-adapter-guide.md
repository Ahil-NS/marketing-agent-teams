# Platform Adapter Guide

> How to build, register, and test platform adapters for `marketing-agent-teams`.

This guide documents the public `PlatformAdapter` interface, the `AdapterRegistry` pattern, per-platform constraints, error handling, auth flow patterns, rate limit integration, and a step-by-step tutorial for building a new adapter.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [PlatformAdapter Interface](#platformadapter-interface)
3. [PlatformName Type](#platformname-type)
4. [Platform Constraints](#platform-constraints)
5. [AdapterRegistry](#adapterregistry)
6. [Reddit Adapter Reference Implementation](#reddit-adapter-reference-implementation)
7. [Auth Flow Patterns](#auth-flow-patterns)
8. [Error Class Hierarchy](#error-class-hierarchy)
9. [Rate Limiting Integration](#rate-limiting-integration)
10. [Adapter Registration for Contributors](#adapter-registration-for-contributors)
11. [Directory Structure for New Adapters](#directory-structure-for-new-adapters)
12. [Integration Test Pattern](#integration-test-pattern)
13. [Tutorial: Building a LinkedIn Adapter](#tutorial-building-a-linkedin-adapter)
14. [Testing Without Real API Credentials](#testing-without-real-api-credentials)

---

## Architecture Overview

Platform adapters live in the **Infrastructure Layer** of the 4-layer boundary architecture. They are called by the `StageRunner` during the **distribution stage** of a pipeline run. Adapters never call the orchestrator or other adapters — all data flows through pipeline state.

```
┌──────────────────────────────────────────────────────────────┐
│  CLI Layer        src/commands/                              │
├──────────────────────────────────────────────────────────────┤
│  Orchestration    src/lib/orchestrator/                      │
│                     └── StageRunner calls adapter methods    │
├──────────────────────────────────────────────────────────────┤
│  Domain           src/lib/agents/, src/lib/review-queue/     │
├──────────────────────────────────────────────────────────────┤
│  Infrastructure   src/lib/platforms/ ← adapters live here    │
│                   src/lib/credentials/                       │
│                   src/lib/state/                             │
└──────────────────────────────────────────────────────────────┘
```

Key constraint: `PlatformAdapter` is a **public API contract**. Changes require semver bumps (NFR23).

---

## PlatformAdapter Interface

Defined in `src/lib/platforms/types.ts`. Every platform adapter must implement this interface.

```typescript
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: PlatformName

  /** Authenticate with platform API using stored credentials */
  authenticate(): Promise<AuthResult>

  /** Validate content against platform-specific constraints before publishing */
  validateContent(content: PlatformContent): Promise<ContentValidationResult>

  /** Publish approved content to the platform */
  publish(content: PlatformContent): Promise<PublishResult>

  /** Get engagement metrics for published content */
  getMetrics(postId: string): Promise<PlatformMetrics>

  /** Get current rate limit status */
  getRateLimits(): Promise<RateLimitStatus>

  /** Disconnect and clean up credentials */
  disconnect(): Promise<void>
}
```

### Method Details

#### `authenticate(): Promise<AuthResult>`

Triggers the platform's OAuth flow. Returns an `AuthResult` indicating success/failure, granted scopes, and token expiry.

```typescript
interface AuthResult {
  success: boolean
  platform: PlatformName
  scopes: string[]
  expiresAt?: string   // ISO 8601
  error?: string       // present when success === false
}
```

#### `validateContent(content: PlatformContent): Promise<ContentValidationResult>`

Validates content against platform constraints **before** publishing. Returns structured errors and warnings.

```typescript
interface PlatformContent {
  itemId: string
  platform: PlatformName
  content: {
    title?: string
    body: string
    hashtags?: string[]
    media?: MediaAttachment[]
    platformMeta: Record<string, unknown>
  }
  scheduledTime?: string
}

interface ContentValidationResult {
  valid: boolean
  platform: PlatformName
  errors: ContentValidationError[]
  warnings: ContentValidationWarning[]
}
```

#### `publish(content: PlatformContent): Promise<PublishResult>`

Submits content to the platform API. Returns a `PublishResult` with the post URL on success or a classified error on failure.

```typescript
interface PublishResult {
  success: boolean
  platform: PlatformName
  itemId: string
  postId?: string
  postUrl?: string
  publishedAt?: string
  error?: PlatformPublishError
}

interface PlatformPublishError {
  code: string
  message: string
  classification: 'transient' | 'permanent'
  retryable: boolean
  retryAfterMs?: number
}
```

#### `getMetrics(postId: string): Promise<PlatformMetrics>`

Retrieves engagement data for a published post.

```typescript
interface PlatformMetrics {
  postId: string
  platform: PlatformName
  views?: number
  likes?: number
  comments?: number
  shares?: number
  engagementRate?: number
  retrievedAt: string  // ISO 8601
}
```

#### `getRateLimits(): Promise<RateLimitStatus>`

Returns the current rate limit status from the platform API.

```typescript
interface RateLimitStatus {
  platform: PlatformName
  remaining: number
  limit: number
  resetsAt: string         // ISO 8601
  windowType: 'minute' | 'hour' | 'day'
}
```

#### `disconnect(): Promise<void>`

Revokes tokens and cleans up the authenticated session. Called during platform removal or cleanup.

---

## PlatformName Type

```typescript
export type PlatformName = 'reddit' | 'tiktok' | 'facebook' | 'instagram'
```

This union type is extensible for community platform adapters. Community adapters add new string literals by augmenting the type via oclif plugin registration.

---

## Platform Constraints

Defined in `src/lib/platforms/content-validator.ts` as `PLATFORM_CONSTRAINTS`. These enforce per-platform content limits during `validateContent()`.

| Platform  | Title Max | Body/Caption Max | Post Max   | Hashtag Max | Requires Title | Requires Media | Requires Subreddit |
|-----------|-----------|-------------------|------------|-------------|----------------|----------------|--------------------|
| Reddit    | 300       | 40,000            | —          | —           | ✅              | —              | ✅                  |
| TikTok    | —         | 2,200             | —          | 30          | —              | ✅              | —                  |
| Instagram | —         | 2,200             | —          | 30          | —              | ✅              | —                  |
| Facebook  | —         | —                 | 63,206     | ∞           | —              | —              | —                  |

```typescript
export const PLATFORM_CONSTRAINTS: Record<PlatformName, PlatformConstraints> = {
  reddit: {
    titleMaxLength: 300,
    bodyMaxLength: 40_000,
    requiresTitle: true,
    requiresSubreddit: true,
    rateLimits: { postsPerDay: null, requestsPerMinute: 60 },
  },
  tiktok: {
    captionMaxLength: 2200,
    hashtagMaxCount: 30,
    requiresMedia: true,
    rateLimits: { postsPerDay: 15, requestsPerMinute: 6 },
  },
  instagram: {
    captionMaxLength: 2200,
    hashtagMaxCount: 30,
    requiresMedia: true,
    tokenExpiryDays: 60,
    tokenRefreshWarningDays: 14,
    rateLimits: { postsPerDay: null, requestsPerHour: 200 },
  },
  facebook: {
    postMaxLength: 63_206,
    hashtagMaxCount: null,
    rateLimits: { postsPerDay: 25, requestsPerHour: 200 },
  },
}
```

The `PlatformConstraints` interface:

```typescript
interface PlatformConstraints {
  titleMaxLength?: number
  bodyMaxLength?: number
  captionMaxLength?: number
  postMaxLength?: number
  hashtagMaxCount?: number | null
  requiresTitle?: boolean
  requiresSubreddit?: boolean
  requiresMedia?: boolean
  tokenExpiryDays?: number
  tokenRefreshWarningDays?: number
  rateLimits: {
    postsPerDay?: number | null
    requestsPerMinute?: number
    requestsPerHour?: number
  }
}
```

---

## AdapterRegistry

Defined in `src/lib/platforms/adapter-registry.ts`. Manages platform adapter registration and lookup.

```typescript
class AdapterRegistry {
  register(adapter: PlatformAdapter): void
  get(platform: PlatformName): PlatformAdapter       // throws PlatformNotRegisteredError
  getAll(): PlatformAdapter[]
  has(platform: PlatformName): boolean
  unregister(platform: PlatformName): boolean
  clear(): void
  readonly size: number
}
```

### Usage

```typescript
import { AdapterRegistry } from '../lib/platforms/index.js'
import { RedditAdapter } from '../lib/platforms/index.js'

const registry = new AdapterRegistry()

// Register an adapter
const reddit = new RedditAdapter({ credentialManager })
registry.register(reddit)

// Retrieve by platform name
const adapter = registry.get('reddit')     // PlatformAdapter
const exists = registry.has('reddit')      // true

// List all registered adapters
const all = registry.getAll()              // PlatformAdapter[]

// Remove an adapter
registry.unregister('reddit')
```

The `register()` method uses the adapter's `platform` property as the key. Registering a second adapter for the same platform replaces the first.

---

## Reddit Adapter Reference Implementation

The `RedditAdapter` in `src/lib/platforms/reddit/` is the primary reference implementation. It demonstrates every aspect of the `PlatformAdapter` contract.

### Class Structure

```typescript
import type { CredentialManager } from '../../credentials/credential-manager.js'
import type { PlatformAdapter, PlatformContent, AuthResult, /* ... */ } from '../types.js'
import { validateContentForPlatform } from '../content-validator.js'

export interface RedditAdapterOptions {
  credentialManager: CredentialManager
  redditUsername?: string
  fetchFn?: typeof globalThis.fetch      // override for testing
  openBrowser?: (url: string) => Promise<void>
  log?: (message: string) => void
}

export class RedditAdapter implements PlatformAdapter {
  readonly platform = 'reddit' as const

  private readonly credentialManager: CredentialManager

  constructor(options: RedditAdapterOptions) {
    this.credentialManager = options.credentialManager
    // ... store test overrides
  }

  async authenticate(): Promise<AuthResult> { /* ... */ }
  async validateContent(content: PlatformContent): Promise<ContentValidationResult> { /* ... */ }
  async publish(content: PlatformContent): Promise<PublishResult> { /* ... */ }
  async getMetrics(postId: string): Promise<PlatformMetrics> { /* ... */ }
  async getRateLimits(): Promise<RateLimitStatus> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
}
```

### OAuth2 Flow with Ephemeral Localhost Callback

Reddit uses the **OAuth2 authorization code flow**. The adapter:

1. Reads `MAT_REDDIT_CLIENT_ID` and `MAT_REDDIT_CLIENT_SECRET` via `getPlatformOAuthConfig('reddit')`
2. Starts an ephemeral HTTP server on `127.0.0.1` (random port) to receive the callback
3. Builds the authorization URL with `duration=permanent` (for refresh tokens)
4. Opens the browser (falls back to printing the URL for headless environments)
5. Exchanges the authorization code for access + refresh tokens
6. Stores tokens via `CredentialManager.store()`

```typescript
// Simplified auth flow
const oauthConfig = getPlatformOAuthConfig('reddit')
const { clientId, clientSecret, config } = oauthConfig

// Ephemeral callback server
const server = createServer(/* handle callback, extract code */)
server.listen(0, '127.0.0.1')  // random available port

const redirectUri = `http://localhost:${port}/callback`
const authUrl = buildRedditAuthorizationUrl(clientId, redirectUri, state, config.scopes)

// Exchange code for tokens
const tokens = await exchangeRedditCode(code, redirectUri, clientId, clientSecret, userAgent)
await credentialManager.store('reddit', tokens, config.scopes)
```

### Rate Limit Handling with Backoff

The Reddit adapter tracks rate limit state from API response headers and uses exponential backoff:

```typescript
private rateLimitState: RedditRateLimitState = {
  remaining: 60,    // requests remaining in window
  resetAt: 0,       // epoch ms when window resets
  used: 0,
}

// Updated from response headers after every API call
// When remaining <= safety threshold (5), waits until resetAt before sending
```

Retry logic: up to 5 attempts with 2000ms base exponential backoff (project standard for platform APIs).

### Content Validation

The adapter combines **static** constraint checking (via `validateContentForPlatform()`) with **dynamic** per-subreddit rules from the Reddit API:

```typescript
async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
  // 1. Static: check title length, body length, required fields
  const staticResult = validateContentForPlatform(content)

  // 2. Dynamic: fetch subreddit post requirements (title min/max, flair required, etc.)
  const requirements = await this.fetchPostRequirements(subreddit)

  // 3. Merge results
  return { valid: errors.length === 0, platform: 'reddit', errors, warnings }
}
```

### Error Handling

All Reddit errors use dedicated error classes extending `MATError`:

```typescript
throw new RedditApiError(statusCode, detail, classification)
throw new RedditSubmitError(errors)
throw new RedditAuthError(detail)
throw new RedditTokenRefreshError(detail)
```

Classifications drive retry behavior:
- **transient** (rate limits, 5xx) → auto-retry via retry queue
- **permanent** (auth errors, submission validation) → user action required

---

## Auth Flow Patterns

### OAuth2 Authorization Code Flow (Reddit, Facebook, Instagram)

Used by platforms that support server-side apps:

```
User → Browser → Platform authorization page → Callback with code
                                                       ↓
          Adapter ← exchangeCode(code) → access_token + refresh_token
                                                       ↓
                  credentialManager.store(platform, tokens, scopes)
```

Environment variables required:
- `MAT_<PLATFORM>_CLIENT_ID`
- `MAT_<PLATFORM>_CLIENT_SECRET`

The `getPlatformOAuthConfig(platform)` helper reads these and returns the platform-specific OAuth URLs and scopes.

### OAuth2 with PKCE (TikTok)

TikTok requires PKCE (Proof Key for Code Exchange) for its OAuth2 flow:

```
1. Generate code_verifier (random 128 bytes)
2. Compute code_challenge = BASE64URL(SHA256(code_verifier))
3. Include code_challenge in authorization URL
4. Include code_verifier in token exchange request
```

The flow is otherwise identical to the standard authorization code flow.

### Credential Storage

- Platform OAuth tokens are stored in the OS keychain via `CredentialManager` (backed by `@aspect-build/keytar`)
- Keychain service name: `marketing-agent-teams:<platform>` (e.g., `marketing-agent-teams:reddit`)
- The `CredentialContext` type (`ReadonlyMap<string, string>`) provides immutable per-agent credential injection
- Adapters receive credentials via constructor injection — they never access keytar directly
- `.mat/credentials/platforms.json` stores **metadata only** (platform name, expiry, scopes) — never tokens

---

## Error Class Hierarchy

All platform errors extend `MATError` and follow the NFR27 three-part message pattern (message, reason, resolution).

Defined in `src/lib/platforms/errors.ts`:

| Error Class                    | Code                        | Severity    | When                                      |
|--------------------------------|-----------------------------|-------------|-------------------------------------------|
| `PlatformNotRegisteredError`   | `PLATFORM_NOT_REGISTERED`   | permanent   | Adapter not found in `AdapterRegistry`     |
| `PlatformAuthError`            | `PLATFORM_AUTH_FAILED`      | permanent   | OAuth flow failure                         |
| `ContentValidationFailedError` | `PLATFORM_CONTENT_INVALID`  | permanent   | Content exceeds platform constraints       |
| `PlatformPublishFailedError`   | `PLATFORM_PUBLISH_FAILED`   | varies      | API submission failure (transient or perm)  |
| `PlatformRateLimitError`       | `PLATFORM_RATE_LIMITED`     | transient   | Rate limit exceeded                        |
| `PlatformTimeoutError`         | `PLATFORM_TIMEOUT`          | transient   | API request timed out                      |
| `PlatformContentPolicyError`   | `PLATFORM_CONTENT_POLICY`   | permanent   | Content blocked by platform policy         |
| `PlatformNetworkError`         | `PLATFORM_NETWORK_ERROR`    | transient   | Network connectivity issue                 |

Example:

```typescript
import { PlatformPublishFailedError } from '../lib/platforms/index.js'

throw new PlatformPublishFailedError('reddit', 'transient', 'Rate limited by Reddit API')
// → code: 'PLATFORM_PUBLISH_FAILED'
// → reason: "Could not publish content to 'reddit'"
// → resolution: "Will retry automatically. Check 'mat status' for retry queue."
// → source: 'platforms/reddit'
// → severity: 'transient'
```

---

## Rate Limiting Integration

The platform module includes a shared `RateLimitTracker` (Story 6.4) that provides:

1. **Header parsing** — extracts rate limit state from platform-specific response headers (Reddit, Meta, TikTok)
2. **Quota checking** — determines if a request is safe to send (`remaining > safetyThreshold`)
3. **Throttling** — `await tracker.throttle(platform)` blocks until quota is available
4. **Error classification** — the `classifyError()` function (in `error-classifier.ts`) maps platform error codes and HTTP status codes to `transient` vs `permanent`

```typescript
import { RateLimitTracker } from '../lib/platforms/index.js'

const tracker = new RateLimitTracker({
  defaultSafetyThreshold: 5,
  safetyThresholds: { reddit: 10 },
})

// Update from API response headers
tracker.updateFromHeaders('reddit', responseHeaders)

// Check before sending
const check = tracker.checkQuota('reddit')
if (!check.allowed) {
  // wait check.waitMs milliseconds
}

// Or use the convenience method:
await tracker.throttle('reddit')
```

Retry strategy (project defaults):
- Platform APIs: **5 attempts**, 2000ms base, exponential backoff
- The retry queue (`src/lib/platforms/retry-queue/`) persists failed publishes for automatic retry

---

## Adapter Registration for Contributors

### Registering a New Adapter

Register your adapter via `AdapterRegistry.register()` in `src/lib/platforms/index.ts`:

```typescript
// In src/lib/platforms/index.ts — add export
export { LinkedInAdapter } from './linkedin/index.js'
export type { LinkedInAdapterOptions } from './linkedin/index.js'

// At registration point (pipeline setup):
import { AdapterRegistry, LinkedInAdapter } from '../lib/platforms/index.js'

const registry = new AdapterRegistry()
registry.register(new LinkedInAdapter({ credentialManager }))
```

### Community Platform Adapters as oclif Plugins

Community adapters are packaged as **oclif plugins**, following the same model as community agents:

```bash
# Install community adapter
mat agents add @community/mat-plugin-linkedin

# The plugin registers its adapter in its oclif init hook
```

A community plugin's `init` hook registers its adapter with the shared `AdapterRegistry`.

---

## Directory Structure for New Adapters

```
src/lib/platforms/<platform-name>/
├── index.ts                 # Public exports (adapter, options type, errors)
├── <platform>-adapter.ts    # PlatformAdapter implementation
├── <platform>-auth.ts       # OAuth flow (code exchange, token refresh, revoke)
├── <platform>-types.ts      # Platform-specific types and Zod schemas
└── errors.ts                # Platform-specific error classes extending MATError
```

Example from the Reddit adapter:

```
src/lib/platforms/reddit/
├── index.ts
├── reddit-adapter.ts
├── reddit-auth.ts
├── reddit-types.ts
└── errors.ts
```

### Public API via index.ts

Every platform module exports through `index.ts` only — never import from internal files:

```typescript
// src/lib/platforms/reddit/index.ts
export { RedditAdapter } from './reddit-adapter.js'
export type { RedditAdapterOptions } from './reddit-adapter.js'
export { RedditApiError, RedditAuthError, /* ... */ } from './errors.js'
export { buildUserAgent, exchangeRedditCode, /* ... */ } from './reddit-auth.js'
export type { RedditSubmitParams, /* ... */ } from './reddit-types.js'
```

---

## Integration Test Pattern

The `StubAdapter` at `src/lib/platforms/adapters/stub-adapter.ts` provides a configurable test double for any platform:

```typescript
import { StubAdapter } from '../lib/platforms/adapters/stub-adapter.js'

const adapter = new StubAdapter({
  platform: 'reddit',
  shouldFailAuth: false,
  shouldFailPublish: false,
  publishResult: { postUrl: 'https://reddit.com/r/test/...' },
  metricsResult: { views: 500, likes: 42 },
})

// Use exactly like a real adapter
const auth = await adapter.authenticate()       // { success: true, ... }
const result = await adapter.publish(content)    // { success: true, postUrl: ... }
```

### StubAdapter Options

```typescript
interface StubAdapterOptions {
  platform: PlatformName
  authResult?: Partial<AuthResult>
  publishResult?: Partial<PublishResult>
  metricsResult?: Partial<PlatformMetrics>
  rateLimitResult?: Partial<RateLimitStatus>
  shouldFailAuth?: boolean       // simulate auth failure
  shouldFailPublish?: boolean    // simulate publish failure
}
```

---

## Tutorial: Building a LinkedIn Adapter

This walkthrough creates a hypothetical **LinkedIn** community adapter to demonstrate the full contributor workflow.

### Step 1: Create the Directory Structure

```
src/lib/platforms/linkedin/
├── index.ts
├── linkedin-adapter.ts
├── linkedin-auth.ts
├── linkedin-types.ts
└── errors.ts
```

### Step 2: Define Platform-Specific Types

```typescript
// src/lib/platforms/linkedin/linkedin-types.ts
import { z } from 'zod'

export const linkedinPostResponseSchema = z.object({
  id: z.string(),
  activity: z.string().optional(),
})

export type LinkedInPostResponse = z.infer<typeof linkedinPostResponseSchema>

export interface LinkedInAdapterOptions {
  credentialManager: CredentialManager
  fetchFn?: typeof globalThis.fetch
}
```

### Step 3: Implement the PlatformAdapter Interface

```typescript
// src/lib/platforms/linkedin/linkedin-adapter.ts
import type {
  PlatformAdapter,
  PlatformContent,
  AuthResult,
  ContentValidationResult,
  PublishResult,
  PlatformMetrics,
  RateLimitStatus,
} from '../types.js'
import { validateContentForPlatform } from '../content-validator.js'
import type { LinkedInAdapterOptions } from './linkedin-types.js'

export class LinkedInAdapter implements PlatformAdapter {
  readonly platform = 'linkedin' as const

  constructor(private readonly options: LinkedInAdapterOptions) {}

  async authenticate(): Promise<AuthResult> {
    // 1. Read MAT_LINKEDIN_CLIENT_ID / MAT_LINKEDIN_CLIENT_SECRET
    // 2. Start ephemeral callback server
    // 3. Build authorization URL
    // 4. Exchange code for tokens
    // 5. Store via credentialManager.store()
    return { success: true, platform: 'linkedin' as any, scopes: ['w_member_social'] }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    return validateContentForPlatform(content)
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    // Call LinkedIn UGC Posts API
    return {
      success: true,
      platform: 'linkedin' as any,
      itemId: content.itemId,
      postId: 'urn:li:share:123',
      postUrl: 'https://linkedin.com/feed/update/urn:li:share:123',
      publishedAt: new Date().toISOString(),
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    // Call LinkedIn Share Statistics API
    return {
      postId,
      platform: 'linkedin' as any,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      retrievedAt: new Date().toISOString(),
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: 'linkedin' as any,
      remaining: 100,
      limit: 100,
      resetsAt: new Date(Date.now() + 86400000).toISOString(),
      windowType: 'day',
    }
  }

  async disconnect(): Promise<void> {
    // Revoke LinkedIn tokens
  }
}
```

### Step 4: Implement OAuth2 Flow

```typescript
// src/lib/platforms/linkedin/linkedin-auth.ts
import type { TokenData } from '../../credentials/types.js'

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenData> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await response.json() as Record<string, unknown>
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) ?? '',
    expiresAt: new Date(Date.now() + (data.expires_in as number) * 1000).toISOString(),
  }
}
```

### Step 5: Define Error Classes

```typescript
// src/lib/platforms/linkedin/errors.ts
import { MATError } from '../../utils/errors.js'

export class LinkedInApiError extends MATError {
  constructor(statusCode: number, detail: string, classification: 'transient' | 'permanent') {
    super(
      `LinkedIn API error (HTTP ${statusCode}): ${detail}`,
      'LINKEDIN_API_ERROR',
      `LinkedIn returned HTTP ${statusCode}: ${detail}`,
      classification === 'transient'
        ? 'Temporary issue — will retry automatically.'
        : 'Fix the issue and try again.',
      'platforms/linkedin',
      classification,
    )
  }
}
```

### Step 6: Register with AdapterRegistry

```typescript
// Registration during pipeline setup:
import { AdapterRegistry } from '../lib/platforms/index.js'
import { LinkedInAdapter } from '../lib/platforms/linkedin/index.js'

const registry = new AdapterRegistry()
registry.register(new LinkedInAdapter({ credentialManager }))

// Now the stage-runner can call:
const adapter = registry.get('linkedin')
await adapter.publish(content)
```

### Step 7: Write Tests Using the StubAdapter Pattern

```typescript
// test/lib/platforms/linkedin/linkedin-adapter.test.ts
import { describe, it, expect } from 'vitest'
import { StubAdapter } from '../../../../src/lib/platforms/adapters/stub-adapter.js'
import { AdapterRegistry } from '../../../../src/lib/platforms/adapter-registry.js'

describe('LinkedInAdapter registration', () => {
  it('can be registered and retrieved', () => {
    // Use StubAdapter as a stand-in during unit tests
    const adapter = new StubAdapter({ platform: 'linkedin' as any })
    const registry = new AdapterRegistry()
    registry.register(adapter)

    const retrieved = registry.get('linkedin' as any)
    expect(retrieved.platform).toBe('linkedin')
  })
})
```

### Step 8: Package as oclif Plugin (Community)

```bash
# Create an oclif plugin project
npx oclif generate mat-plugin-linkedin

# In the plugin's init hook, register the adapter:
# src/hooks/init.ts
export default async function init() {
  const { LinkedInAdapter } = await import('./platforms/linkedin/index.js')
  globalRegistry.register(new LinkedInAdapter({ credentialManager }))
}

# Users install with:
mat agents add @community/mat-plugin-linkedin
```

---

## Testing Without Real API Credentials

Use these patterns to test adapters without hitting real platform APIs:

### 1. StubAdapter for Interface Compliance

```typescript
const adapter = new StubAdapter({ platform: 'reddit' })
const result = await adapter.publish(content)
expect(result.success).toBe(true)
```

### 2. Constructor Injection for Fetch

All adapters accept a `fetchFn` option to swap `fetch` in tests:

```typescript
const mockFetch = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ success: true }), { status: 200 })
)

const adapter = new RedditAdapter({
  credentialManager,
  fetchFn: mockFetch,
})
```

### 3. Mock CredentialManager

```typescript
const mockCredentialManager = {
  store: vi.fn(),
  retrieve: vi.fn().mockResolvedValue({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }),
  delete: vi.fn(),
} as unknown as CredentialManager
```

### 4. Registry Integration Test

Verify that any adapter implementing `PlatformAdapter` can be registered and called generically:

```typescript
const registry = new AdapterRegistry()
const adapter = new StubAdapter({ platform: 'reddit' })
registry.register(adapter)

// Stage-runner calls adapter methods polymorphically
const platformAdapter = registry.get('reddit')
const auth = await platformAdapter.authenticate()
const validation = await platformAdapter.validateContent(content)
const result = await platformAdapter.publish(content)
```

---

## Quick Reference

| What                        | Where                                          |
|-----------------------------|------------------------------------------------|
| PlatformAdapter interface   | `src/lib/platforms/types.ts`                   |
| AdapterRegistry             | `src/lib/platforms/adapter-registry.ts`         |
| Platform constraints        | `src/lib/platforms/content-validator.ts`         |
| Error classes               | `src/lib/platforms/errors.ts`                   |
| StubAdapter (test double)   | `src/lib/platforms/adapters/stub-adapter.ts`    |
| Rate limit tracker          | `src/lib/platforms/rate-limiter.ts`             |
| Error classifier            | `src/lib/platforms/error-classifier.ts`         |
| Reddit adapter (reference)  | `src/lib/platforms/reddit/reddit-adapter.ts`    |
| Public API exports          | `src/lib/platforms/index.ts`                    |
| Credential types            | `src/lib/credentials/types.ts`                 |
| OAuth config defaults       | `src/lib/credentials/platform-oauth-config.ts` |
