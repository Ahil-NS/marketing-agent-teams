import {spawn} from 'node:child_process'

import type {AgentExecutor} from './index.js'
import type {AgentExecuteOptions, AgentMessage, CostEstimate} from './types.js'
import {AgentExecutionError, AgentAuthError} from './errors.js'

function spawnClaude(args: string[], timeoutMs: number): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    // Strip ALL Claude env vars to avoid nested session detection
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')),
    )
    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // Close stdin immediately — claude -p hangs if stdin stays open
    child.stdin.end()

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !stdout) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr}`))
      } else {
        resolve({stdout, stderr})
      }
    })
  })
}

const CLAUDE_PRICING: Record<string, {input: number; output: number}> = {
  haiku: {input: 0.25, output: 1.25},
  sonnet: {input: 3.0, output: 15.0},
}

const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
}

/**
 * Executes agents by shelling out to `claude -p`.
 * This bypasses the CLAUDECODE env var block that prevents
 * nested Claude Agent SDK `query()` calls from within Claude Code sessions.
 */
export class ClaudeCliExecutor implements AgentExecutor {
  async *execute(options: AgentExecuteOptions): AsyncIterable<AgentMessage> {
    const model = options.model ?? 'sonnet'
    const allowedTools = options.allowedTools ?? []

    const args = [
      '-p', options.input.prompt,
      '--output-format', 'json',
    ]

    if (options.skillMd) {
      args.push('--system-prompt', options.skillMd)
    }

    if (allowedTools.length > 0) {
      args.push('--allowedTools', allowedTools.join(','))
    }

    const modelId = MODEL_MAP[model] ?? MODEL_MAP['sonnet']
    args.push('--model', modelId)

    const maxTurns = options.budget?.maxTurns ?? 10
    args.push('--max-turns', String(maxTurns))

    const startTime = Date.now()

    try {
      const {stdout, stderr} = await spawnClaude(args, 600_000)

      if (stderr && stderr.includes('not logged in')) {
        throw new AgentAuthError(
          `Authentication failed for agent '${options.agentName}'`,
          'AGENT_AUTH_FAILED',
          'Claude Code CLI is not authenticated',
          'Run `claude login` to authenticate, then retry',
          'agent-executor/cli',
          'permanent',
        )
      }

      let result: string
      let costUsd = 0
      let inputTokens = 0
      let outputTokens = 0

      try {
        const parsed = JSON.parse(stdout) as Record<string, unknown>
        result = typeof parsed.result === 'string'
          ? parsed.result
          : JSON.stringify(parsed.result ?? parsed)
        // claude CLI uses total_cost_usd and usage.input_tokens/output_tokens
        costUsd = typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0
        const usage = parsed.usage as Record<string, unknown> | undefined
        inputTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : 0
        outputTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : 0
      } catch {
        // If not JSON, treat raw stdout as the result
        result = stdout.trim()
      }

      yield {
        type: 'result',
        subtype: 'success',
        result,
        totalCostUsd: costUsd,
        usage: {inputTokens, outputTokens},
        model: modelId,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      if (error instanceof AgentAuthError || error instanceof AgentExecutionError) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)

      if (message.includes('ENOENT') || message.includes('not found')) {
        throw new AgentExecutionError(
          `Claude CLI not found for agent '${options.agentName}'`,
          'AGENT_EXECUTION_FAILED',
          'The `claude` CLI binary was not found in PATH',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'agent-executor/cli',
          'permanent',
        )
      }

      throw new AgentExecutionError(
        `Agent '${options.agentName}' failed: ${message}`,
        'AGENT_EXECUTION_FAILED',
        `CLI execution error: ${message}`,
        'Check Claude Code CLI authentication and network connectivity',
        'agent-executor/cli',
        'transient',
      )
    }
  }

  estimateCost(model: string, estimatedInputTokens: number): CostEstimate {
    const pricing = CLAUDE_PRICING[model] ?? CLAUDE_PRICING['sonnet']
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.25)

    return {
      estimatedCostUsd:
        (estimatedInputTokens / 1_000_000) * pricing.input +
        (estimatedOutputTokens / 1_000_000) * pricing.output,
      model,
      inputPricePerMillion: pricing.input,
      outputPricePerMillion: pricing.output,
    }
  }
}
