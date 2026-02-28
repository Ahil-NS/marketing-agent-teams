import type {Hook} from '@oclif/core'

import {CLI_COMMAND_NOT_FOUND, MATError} from '../lib/utils/errors.js'

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

export function findClosestCommand(input: string, commands: string[]): string | undefined {
  let bestMatch: string | undefined
  let bestDistance = Infinity

  for (const cmd of commands) {
    const distance = levenshtein(input, cmd)
    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = cmd
    }
  }

  // Only suggest if the distance is reasonable (less than half the command length)
  if (bestMatch && bestDistance <= Math.max(2, Math.floor(bestMatch.length / 2))) {
    return bestMatch
  }

  return undefined
}

const hook: Hook.CommandNotFound = async function (options) {
  const commandIds = options.config.commandIDs

  const closest = findClosestCommand(options.id, [...commandIds])

  const resolution = closest
    ? `Did you mean '${options.config.bin} ${closest}'? Run '${options.config.bin} --help' for available commands.`
    : `Run '${options.config.bin} --help' for available commands.`

  const error = new MATError(
    `Command not found: '${options.config.bin} ${options.id}'`,
    CLI_COMMAND_NOT_FOUND,
    `'${options.config.bin} ${options.id}' is not a known command.`,
    resolution,
    'cli',
    'permanent',
  )

  this.error(`${error.reason}\n${error.resolution}`, {exit: 127, code: error.code})
}

export default hook
