import {execFile} from 'node:child_process'

import {checkbox, input, select} from '@inquirer/prompts'

import {ClaudeAuthError, SETUP_CLAUDE_AUTH_FAILED, SETUP_CLAUDE_NOT_FOUND} from './errors.js'

export interface WizardAnswers {
  productName: string
  platforms: string[]
  skillLevel: string
}

function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout)
      }
    })
  })
}

export async function verifyClaude(): Promise<void> {
  let stdout: string
  try {
    stdout = await execFileAsync('claude', ['--version'])
  } catch {
    throw new ClaudeAuthError(
      'Claude Code CLI not found',
      SETUP_CLAUDE_NOT_FOUND,
      'Claude Code CLI is not installed or not in PATH',
      'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code, then run: claude login',
      'setup/wizard',
      'permanent',
    )
  }

  if (!stdout.includes('claude')) {
    throw new ClaudeAuthError(
      'Claude Code CLI verification failed',
      SETUP_CLAUDE_AUTH_FAILED,
      'claude --version returned unexpected output',
      'Verify Claude Code CLI is properly installed: claude --version',
      'setup/wizard',
      'permanent',
    )
  }
}

export async function promptWizard(): Promise<WizardAnswers> {
  const productName = await input({
    message: 'Product name:',
    validate: (value: string) => value.trim().length > 0 || 'Product name is required',
  })

  const platforms = await checkbox({
    message: 'Target platforms:',
    choices: [
      {value: 'reddit', name: 'Reddit'},
      {value: 'tiktok', name: 'TikTok'},
      {value: 'facebook', name: 'Facebook'},
      {value: 'instagram', name: 'Instagram'},
    ],
    validate: (value: readonly { value: string }[]) => value.length > 0 || 'Select at least one platform',
  })

  const skillLevel = await select({
    message: 'Skill level:',
    choices: [
      {value: 'beginner', name: 'Beginner'},
      {value: 'intermediate', name: 'Intermediate'},
      {value: 'advanced', name: 'Advanced'},
    ],
    default: 'intermediate',
  })

  return {productName, platforms, skillLevel}
}
