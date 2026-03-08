import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {Hook} from '@oclif/core'
import YAML from 'yaml'

import {verifyClaudeAuth} from '../lib/auth/index.js'
import {checkBudget} from '../lib/budget/index.js'
import {CredentialManager} from '../lib/credentials/credential-manager.js'
import {KeytarKeychainAdapter} from '../lib/credentials/keychain-adapter.js'
import {setTokenRefreshResults} from '../lib/hooks/prerun-context.js'
import type {TokenRefreshStatus} from '../lib/credentials/token-refresher.js'
import {AdapterRegistry} from '../lib/platforms/adapter-registry.js'
import {PlatformConnectionManager} from '../lib/platforms/connection-manager.js'
import {TokenLifecycleManager} from '../lib/platforms/token-lifecycle.js'
import {MATError} from '../lib/utils/errors.js'

const SKIP_AUTH_COMMANDS = new Set([
  'install', 'config', 'config:agents', 'config:platforms',
  'config:platforms:add', 'config:platforms:remove', 'config:voice',
  'agents', 'agents:list', 'agents:validate', 'agents:lint', 'agents:trust',
  'agents:add', 'agents:remove',
  'review', 'review:list', 'review:show', 'review:approve', 'review:reject', 'review:edit',
  'status', 'logs', 'attach', 'help',
  'context', 'history', 'dashboard',
])

const BUDGET_CHECK_COMMANDS = new Set(['run', 'create', 'agents:test'])

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

  // 4. Token refresh — use TokenLifecycleManager for proactive refresh (AC4)
  try {
    const credManager = new CredentialManager(new KeytarKeychainAdapter(), process.cwd())
    const adapterRegistry = new AdapterRegistry()
    const connectionManager = new PlatformConnectionManager(credManager, adapterRegistry)
    const lifecycleManager = new TokenLifecycleManager(credManager, connectionManager)

    const summary = await lifecycleManager.refreshExpiringTokens()

    // Build legacy-format results for backward compatibility
    const refreshResult: Record<string, TokenRefreshStatus> = {}
    for (const platform of summary.refreshed) {
      refreshResult[platform] = 'refreshed'
      this.debug(`Token refreshed for ${platform}`)
    }

    for (const failure of summary.failed) {
      refreshResult[failure.platform] = 'failed'
      this.warn(`Token refresh failed for ${failure.platform}. Run '${failure.reAuthCommand}' to reconnect.`)
    }

    setTokenRefreshResults(refreshResult)
  } catch {
    this.debug('Token refresh check skipped (no credentials configured)')
  }
}

export default hook
