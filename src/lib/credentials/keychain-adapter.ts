import keytar from 'keytar'

import type { KeychainAdapter } from './types.js'
import { KeychainUnavailableError } from './errors.js'

export class KeytarKeychainAdapter implements KeychainAdapter {
  async setPassword(service: string, account: string, password: string): Promise<void> {
    try {
      await keytar.setPassword(service, account, password)
    } catch (error) {
      throw new KeychainUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      return await keytar.getPassword(service, account)
    } catch (error) {
      throw new KeychainUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      return await keytar.deletePassword(service, account)
    } catch (error) {
      throw new KeychainUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}
