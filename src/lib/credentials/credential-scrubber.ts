import type { CredentialContext } from './types.js'

export function scrubCredentials(
  text: string,
  context: CredentialContext,
): string {
  let scrubbed = text
  for (const [platform, token] of context) {
    if (token && text.includes(token)) {
      scrubbed = scrubbed.replaceAll(token, `[REDACTED:${platform}]`)
    }
  }
  return scrubbed
}
