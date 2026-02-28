import type {TokenRefreshStatus} from '../credentials/token-refresher.js'

let _tokenRefreshResults: Record<string, TokenRefreshStatus> = {}

export function setTokenRefreshResults(results: Record<string, TokenRefreshStatus>): void {
  _tokenRefreshResults = results
}

export function getTokenRefreshResults(): Record<string, TokenRefreshStatus> {
  return _tokenRefreshResults
}
