import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { KeychainAdapter } from './types.js'

const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32
const IV_LENGTH = 16
const KEY_LENGTH = 32

interface EncryptedStore {
  [account: string]: {
    encrypted: string // base64
    salt: string // hex
    iv: string // hex
    authTag: string // hex
  }
}

export class FileKeychainAdapter implements KeychainAdapter {
  private readonly storePath: string
  private readonly passphrase: string

  constructor(projectRoot: string, passphrase: string) {
    this.storePath = join(projectRoot, '.mat', 'credentials', '.keystore')
    this.passphrase = passphrase
  }

  async setPassword(_service: string, account: string, password: string): Promise<void> {
    const store = await this.loadStore()
    const salt = randomBytes(SALT_LENGTH)
    const key = scryptSync(this.passphrase, salt, KEY_LENGTH)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(password, 'utf-8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    store[account] = {
      encrypted: encrypted.toString('base64'),
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    }

    await this.saveStore(store)
  }

  async getPassword(_service: string, account: string): Promise<string | null> {
    const store = await this.loadStore()
    const entry = store[account]
    if (!entry) return null

    const key = scryptSync(this.passphrase, Buffer.from(entry.salt, 'hex'), KEY_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(entry.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(entry.authTag, 'hex'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(entry.encrypted, 'base64')),
      decipher.final(),
    ])

    return decrypted.toString('utf-8')
  }

  async deletePassword(_service: string, account: string): Promise<boolean> {
    const store = await this.loadStore()
    if (!(account in store)) return false
    delete store[account]
    await this.saveStore(store)
    return true
  }

  private async loadStore(): Promise<EncryptedStore> {
    try {
      const raw = await readFile(this.storePath, 'utf-8')
      return JSON.parse(raw) as EncryptedStore
    } catch {
      return {}
    }
  }

  private async saveStore(store: EncryptedStore): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true })
    await writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8')
  }
}
