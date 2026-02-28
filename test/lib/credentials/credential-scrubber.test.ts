import { describe, expect, it } from 'vitest'

import { scrubCredentials } from '../../../src/lib/credentials/credential-scrubber.js'
import type { CredentialContext } from '../../../src/lib/credentials/types.js'

function makeContext(entries: [string, string][]): CredentialContext {
  return Object.freeze(new Map(entries))
}

describe('scrubCredentials', () => {
  it('replaces a single token value with redaction marker', () => {
    const context = makeContext([['reddit-oauth', 'secret-reddit-token-abc123']])
    const text = 'Posting to reddit with token secret-reddit-token-abc123 at /api/v1'

    const result = scrubCredentials(text, context)

    expect(result).toBe('Posting to reddit with token [REDACTED:reddit-oauth] at /api/v1')
    expect(result).not.toContain('secret-reddit-token-abc123')
  })

  it('replaces multiple different token values', () => {
    const context = makeContext([
      ['reddit-oauth', 'reddit-tok-aaa'],
      ['tiktok-oauth', 'tiktok-tok-bbb'],
    ])
    const text = 'reddit: reddit-tok-aaa, tiktok: tiktok-tok-bbb'

    const result = scrubCredentials(text, context)

    expect(result).toBe('reddit: [REDACTED:reddit-oauth], tiktok: [REDACTED:tiktok-oauth]')
  })

  it('replaces all occurrences of the same token', () => {
    const context = makeContext([['reddit-oauth', 'tok-123']])
    const text = 'first tok-123 and second tok-123'

    const result = scrubCredentials(text, context)

    expect(result).toBe('first [REDACTED:reddit-oauth] and second [REDACTED:reddit-oauth]')
    expect(result).not.toContain('tok-123')
  })

  it('returns original text when context is empty', () => {
    const context = makeContext([])
    const text = 'No secrets here'

    const result = scrubCredentials(text, context)

    expect(result).toBe('No secrets here')
  })

  it('returns original text when no tokens appear in text', () => {
    const context = makeContext([['reddit-oauth', 'secret-token']])
    const text = 'This text has no token values'

    const result = scrubCredentials(text, context)

    expect(result).toBe('This text has no token values')
  })

  it('handles token value that appears as substring in non-credential text', () => {
    const context = makeContext([['reddit-oauth', 'abc']])
    const text = 'xyzabcdef contains abc as substring'

    const result = scrubCredentials(text, context)

    // All occurrences of the token string get redacted
    expect(result).toBe('xyz[REDACTED:reddit-oauth]def contains [REDACTED:reddit-oauth] as substring')
  })

  it('handles empty string input', () => {
    const context = makeContext([['reddit-oauth', 'secret']])

    const result = scrubCredentials('', context)

    expect(result).toBe('')
  })

  it('handles large text with multiple tokens', () => {
    const context = makeContext([
      ['reddit-oauth', 'reddit-secret-long-token-value-12345'],
      ['tiktok-oauth', 'tiktok-secret-long-token-value-67890'],
      ['facebook-oauth', 'fb-secret-long-token-value-abcde'],
    ])
    const text = JSON.stringify({
      log: 'Agent executed with reddit-secret-long-token-value-12345',
      state: { token: 'tiktok-secret-long-token-value-67890' },
      debug: 'fb-secret-long-token-value-abcde used for API call',
    })

    const result = scrubCredentials(text, context)

    expect(result).not.toContain('reddit-secret-long-token-value-12345')
    expect(result).not.toContain('tiktok-secret-long-token-value-67890')
    expect(result).not.toContain('fb-secret-long-token-value-abcde')
    expect(result).toContain('[REDACTED:reddit-oauth]')
    expect(result).toContain('[REDACTED:tiktok-oauth]')
    expect(result).toContain('[REDACTED:facebook-oauth]')
  })
})
