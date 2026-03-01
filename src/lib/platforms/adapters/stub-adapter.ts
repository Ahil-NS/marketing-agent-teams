import type {
  AuthResult,
  ContentValidationResult,
  PlatformAdapter,
  PlatformContent,
  PlatformMetrics,
  PlatformName,
  PublishResult,
  RateLimitStatus,
} from '../types.js'
import {validateContentForPlatform} from '../content-validator.js'

export interface StubAdapterOptions {
  platform: PlatformName
  authResult?: Partial<AuthResult>
  publishResult?: Partial<PublishResult>
  metricsResult?: Partial<PlatformMetrics>
  rateLimitResult?: Partial<RateLimitStatus>
  shouldFailAuth?: boolean
  shouldFailPublish?: boolean
}

export class StubAdapter implements PlatformAdapter {
  readonly platform: PlatformName
  private readonly options: StubAdapterOptions

  constructor(options: StubAdapterOptions) {
    this.platform = options.platform
    this.options = options
  }

  async authenticate(): Promise<AuthResult> {
    if (this.options.shouldFailAuth) {
      return {
        success: false,
        platform: this.platform,
        scopes: [],
        error: 'Stub authentication failure',
        ...this.options.authResult,
      }
    }

    return {
      success: true,
      platform: this.platform,
      scopes: ['read', 'write'],
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      ...this.options.authResult,
    }
  }

  async validateContent(content: PlatformContent): Promise<ContentValidationResult> {
    return validateContentForPlatform(content)
  }

  async publish(content: PlatformContent): Promise<PublishResult> {
    if (this.options.shouldFailPublish) {
      return {
        success: false,
        platform: this.platform,
        itemId: content.itemId,
        error: {
          code: 'STUB_PUBLISH_FAILURE',
          message: 'Stub publish failure',
          classification: 'transient',
          retryable: true,
          retryAfterMs: 5000,
        },
        ...this.options.publishResult,
      }
    }

    return {
      success: true,
      platform: this.platform,
      itemId: content.itemId,
      postId: `stub-post-${Date.now()}`,
      postUrl: `https://${this.platform}.example.com/posts/stub-post-${Date.now()}`,
      publishedAt: new Date().toISOString(),
      ...this.options.publishResult,
    }
  }

  async getMetrics(postId: string): Promise<PlatformMetrics> {
    return {
      postId,
      platform: this.platform,
      views: 100,
      likes: 10,
      comments: 5,
      shares: 2,
      engagementRate: 0.17,
      retrievedAt: new Date().toISOString(),
      ...this.options.metricsResult,
    }
  }

  async getRateLimits(): Promise<RateLimitStatus> {
    return {
      platform: this.platform,
      remaining: 50,
      limit: 60,
      resetsAt: new Date(Date.now() + 60 * 1000).toISOString(),
      windowType: 'minute',
      ...this.options.rateLimitResult,
    }
  }

  async disconnect(): Promise<void> {
    // No-op for stub adapter
  }
}
