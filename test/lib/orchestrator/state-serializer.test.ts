import {readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {mkdtemp, rm} from 'node:fs/promises'

import {PipelineCorruptedError, PipelineNotFoundError} from '../../../src/lib/orchestrator/errors.js'
import {
  listPipelineRuns,
  loadPipelineRun,
  pipelineRunExists,
  savePipelineRun,
} from '../../../src/lib/orchestrator/state-serializer.js'
import {createTestPipelineRun} from '../../helpers/pipeline-state-factory.js'

describe('state-serializer', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mat-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, {recursive: true, force: true})
  })

  describe('savePipelineRun', () => {
    it('creates the state directory if it does not exist', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const filePath = join(tmpDir, '.mat/state/pipeline-runs', `${state.id}.json`)
      const content = await readFile(filePath, 'utf-8')
      expect(JSON.parse(content)).toEqual(state)
    })

    it('writes valid JSON to disk', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const filePath = join(tmpDir, '.mat/state/pipeline-runs', `${state.id}.json`)
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.id).toBe(state.id)
      expect(parsed.status).toBe('running')
    })

    it('cleans up .tmp file after successful write (atomic rename)', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const tmpPath = join(tmpDir, '.mat/state/pipeline-runs', `${state.id}.json.tmp`)
      await expect(readFile(tmpPath)).rejects.toThrow()
    })

    it('overwrites existing state file', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const updated = {...state, status: 'paused' as const, updatedAt: '2026-02-28T10:05:00.000Z'}
      await savePipelineRun(updated, tmpDir)

      const filePath = join(tmpDir, '.mat/state/pipeline-runs', `${state.id}.json`)
      const raw = await readFile(filePath, 'utf-8')
      expect(JSON.parse(raw).status).toBe('paused')
    })
  })

  describe('loadPipelineRun', () => {
    it('loads and validates saved pipeline run (round-trip)', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const loaded = await loadPipelineRun(state.id, tmpDir)
      expect(loaded.id).toBe(state.id)
      expect(loaded.status).toBe(state.status)
      expect(loaded.currentStage).toBe(state.currentStage)
      expect(loaded.budget).toEqual(state.budget)
    })

    it('throws PipelineNotFoundError for non-existent run ID', async () => {
      await expect(
        loadPipelineRun('non-existent-id', tmpDir),
      ).rejects.toThrow(PipelineNotFoundError)
    })

    it('throws PipelineCorruptedError for invalid JSON', async () => {
      const stateDir = join(tmpDir, '.mat/state/pipeline-runs')
      const {mkdir} = await import('node:fs/promises')
      await mkdir(stateDir, {recursive: true})
      const badRunId = 'deadbeef-dead-beef-dead-beefdeadbeef'
      await writeFile(join(stateDir, `${badRunId}.json`), 'not valid json{{{', 'utf-8')

      await expect(
        loadPipelineRun(badRunId, tmpDir),
      ).rejects.toThrow(PipelineCorruptedError)
    })

    it('throws PipelineCorruptedError for valid JSON that fails schema validation', async () => {
      const stateDir = join(tmpDir, '.mat/state/pipeline-runs')
      const {mkdir} = await import('node:fs/promises')
      await mkdir(stateDir, {recursive: true})
      const schemaFailId = 'cafebabe-cafe-babe-cafe-babecafebabe'
      await writeFile(
        join(stateDir, `${schemaFailId}.json`),
        JSON.stringify({id: 'not-a-uuid', status: 'unknown'}),
        'utf-8',
      )

      await expect(
        loadPipelineRun(schemaFailId, tmpDir),
      ).rejects.toThrow(PipelineCorruptedError)
    })
  })

  describe('listPipelineRuns', () => {
    it('returns empty array when no runs exist', async () => {
      const runs = await listPipelineRuns(tmpDir)
      expect(runs).toEqual([])
    })

    it('returns run IDs from disk', async () => {
      const state1 = createTestPipelineRun({id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'})
      const state2 = createTestPipelineRun({id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'})
      await savePipelineRun(state1, tmpDir)
      await savePipelineRun(state2, tmpDir)

      const runs = await listPipelineRuns(tmpDir)
      expect(runs).toHaveLength(2)
      expect(runs).toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(runs).toContain('b2c3d4e5-f6a7-8901-bcde-f12345678901')
    })

    it('excludes .tmp files', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      // Create a leftover .tmp file
      const stateDir = join(tmpDir, '.mat/state/pipeline-runs')
      await writeFile(join(stateDir, 'leftover.json.tmp'), '{}', 'utf-8')

      const runs = await listPipelineRuns(tmpDir)
      expect(runs).not.toContain('leftover.json')
      expect(runs).toContain(state.id)
    })
  })

  describe('pipelineRunExists', () => {
    it('returns true for existing run', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const exists = await pipelineRunExists(state.id, tmpDir)
      expect(exists).toBe(true)
    })

    it('returns false for non-existent run', async () => {
      const exists = await pipelineRunExists('a1b2c3d4-e5f6-7890-abcd-000000000000', tmpDir)
      expect(exists).toBe(false)
    })

    it('rejects non-UUID runId (path traversal protection)', async () => {
      await expect(
        pipelineRunExists('../../etc/passwd', tmpDir),
      ).rejects.toThrow(PipelineNotFoundError)
    })
  })

  describe('path traversal protection', () => {
    it('rejects runId with path traversal sequences in loadPipelineRun', async () => {
      await expect(
        loadPipelineRun('../../etc/passwd', tmpDir),
      ).rejects.toThrow(PipelineNotFoundError)
    })

    it('rejects runId with directory separators in loadPipelineRun', async () => {
      await expect(
        loadPipelineRun('foo/bar', tmpDir),
      ).rejects.toThrow(PipelineNotFoundError)
    })

    it('rejects non-UUID runId in pipelineRunExists', async () => {
      await expect(
        pipelineRunExists('../../../secret', tmpDir),
      ).rejects.toThrow(PipelineNotFoundError)
    })

    it('accepts valid UUID format in loadPipelineRun', async () => {
      const state = createTestPipelineRun()
      await savePipelineRun(state, tmpDir)

      const loaded = await loadPipelineRun(state.id, tmpDir)
      expect(loaded.id).toBe(state.id)
    })
  })

  describe('listPipelineRuns ordering', () => {
    it('returns runs sorted by most recent mtime first', async () => {
      const state1 = createTestPipelineRun({id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'})
      await savePipelineRun(state1, tmpDir)

      // Small delay to ensure different mtimes
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })

      const state2 = createTestPipelineRun({id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901'})
      await savePipelineRun(state2, tmpDir)

      const runs = await listPipelineRuns(tmpDir)
      expect(runs[0]).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901')
      expect(runs[1]).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    })
  })
})
