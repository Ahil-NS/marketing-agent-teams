import {execFile} from 'node:child_process'

import {ClaudeNotAuthenticatedError, ClaudeNotInstalledError} from './errors.js'

function execFileAsync(cmd: string, args: string[], opts: {timeout: number}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

export async function verifyClaudeAuth(): Promise<string> {
  try {
    const stdout = await execFileAsync('claude', ['--version'], {timeout: 5000})
    return stdout.trim()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new ClaudeNotInstalledError()
    }

    throw new ClaudeNotAuthenticatedError()
  }
}
