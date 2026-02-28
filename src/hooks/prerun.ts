import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {Hook} from '@oclif/core'
import YAML from 'yaml'

import {verifyClaudeAuth} from '../lib/auth/index.js'
import {checkBudget} from '../lib/budget/index.js'
import {refreshExpiredTokens} from '../lib/credentials/token-refresher.js'
import {setTokenRefreshResults} from '../lib/hooks/prerun-context.js'
import {MATError} from '../lib/utils/errors.js'

const SKIP_AUTH_COMMANDS = new Set([
  'install', 'config', 'config:agents', 'config:platforms',
  'config:voice', 'help',
])

const BUDGET_CHECK_COMMANDS = new Set(['run', 'agents:test'])

const hook: Hook.Prerun = async function (options) {
  const commandId = options.Command.id

  // 1. Skip check — zero overhead for non-auth commands
  if (SKIP_AUTH_COMMANDS.has(commandId)) return

  // 2. Auth verification
  try {
    await verifyClaudeAuth()
  } catch (error) {
    if (error instanceof MATError) {
      this.error(`${error.reason}\n${error.resolution}`, {
        exit: 1,
        code: error.code,
      })
    }

    this.error('Claude Code auth failed', {exit: 1, code: 'AUTH_FAILED'})
  }

  // 3. Budget check (only for pipeline commands)
  if (BUDGET_CHECK_COMMANDS.has(commandId)) {
    try {
      // Read budget limit from config (init hook validated config exists)
      let budgetLimit = 10
      try {
        const configRaw = await readFile(join(process.cwd(), '.mat', 'config.yaml'), 'utf-8')
        const config = YAML.parse(configRaw)
        budgetLimit = config?.agents?.budgetLimit ?? 10
      } catch {
        // Config read failure — use default limit
      }

      const result = await checkBudget(process.cwd(), budgetLimit)
      if (result.warning) {
        this.warn(result.warning)
      }
    } catch (error) {
      if (error instanceof MATError) {
        this.error(`${error.reason}\n${error.resolution}`, {
          exit: 1,
          code: error.code,
        })
      }

      this.error('Budget check failed', {exit: 1, code: 'BUDGET_CHECK_FAILED'})
    }
  }

  // 4. Token refresh — warn on failure, never block execution
  try {
    const refreshResult = await refreshExpiredTokens(process.cwd())
    setTokenRefreshResults(refreshResult)
    for (const [platform, status] of Object.entries(refreshResult)) {
      if (status === 'refreshed') {
        this.debug(`Token refreshed for ${platform}`)
      } else if (status === 'failed') {
        this.warn(`Token refresh failed for ${platform}. Run 'mat config platforms add ${platform}' to reconnect.`)
      }
    }
  } catch {
    this.debug('Token refresh check skipped (no credentials configured)')
  }
}

export default hook
