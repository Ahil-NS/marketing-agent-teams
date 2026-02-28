import {describe, expect, it} from 'vitest'

import {findClosestCommand} from '../../src/hooks/command-not-found.js'

describe('command-not-found hook', () => {
  const commands = ['install', 'run', 'review', 'status', 'config', 'agents:list', 'logs']

  describe('findClosestCommand', () => {
    it('suggests "run" for "runn"', () => {
      expect(findClosestCommand('runn', commands)).toBe('run')
    })

    it('suggests "install" for "instal"', () => {
      expect(findClosestCommand('instal', commands)).toBe('install')
    })

    it('suggests "status" for "statis"', () => {
      expect(findClosestCommand('statis', commands)).toBe('status')
    })

    it('suggests "logs" for "log"', () => {
      expect(findClosestCommand('log', commands)).toBe('logs')
    })

    it('suggests "config" for "conifg"', () => {
      expect(findClosestCommand('conifg', commands)).toBe('config')
    })

    it('returns undefined for completely unrelated input', () => {
      expect(findClosestCommand('xyzabc123foobar', commands)).toBeUndefined()
    })

    it('returns exact match when input matches a command', () => {
      expect(findClosestCommand('run', commands)).toBe('run')
    })

    it('handles empty command list', () => {
      expect(findClosestCommand('run', [])).toBeUndefined()
    })
  })
})
