import {describe, it, expect} from 'vitest'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'

describe('SDK version pinning (AC4)', () => {
  it('pins @anthropic-ai/claude-agent-sdk to exact version 0.2.63 (no caret, no tilde)', async () => {
    const packageJsonPath = resolve(import.meta.dirname, '..', '..', '..', 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    const sdkVersion = packageJson.dependencies['@anthropic-ai/claude-agent-sdk']

    // Must be exact — no ^ or ~ prefix
    expect(sdkVersion).toBe('0.2.63')
    expect(sdkVersion).not.toMatch(/^[\^~]/)
  })
})
