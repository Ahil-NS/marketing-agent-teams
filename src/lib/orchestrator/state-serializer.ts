import {mkdir, readFile, readdir, rename, stat, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import {pipelineRunSchema} from '../schemas/pipeline-run-schema.js'

import {PipelineCorruptedError, PipelineNotFoundError, PipelineSerializeError} from './errors.js'
import type {PipelineRun} from './types.js'

const STATE_DIR = '.mat/state/pipeline-runs'

/**
 * UUID v4 regex pattern for validating runId parameters.
 * Prevents path traversal attacks by ensuring runId matches expected format.
 */
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

function validateRunId(runId: string): void {
  if (!UUID_PATTERN.test(runId)) {
    throw new PipelineNotFoundError(runId)
  }
}

function getStateDir(projectDir: string): string {
  return join(projectDir, STATE_DIR)
}

function getStatePath(projectDir: string, runId: string): string {
  return join(getStateDir(projectDir), `${runId}.json`)
}

/**
 * Saves pipeline run state to disk using atomic write.
 * Writes to a .tmp file first, then renames — prevents corruption on crash.
 */
export async function savePipelineRun(
  state: PipelineRun,
  projectDir: string = process.cwd(),
): Promise<void> {
  const stateDir = getStateDir(projectDir)
  await mkdir(stateDir, {recursive: true})

  const filePath = getStatePath(projectDir, state.id)
  const tmpPath = `${filePath}.tmp`

  try {
    const json = JSON.stringify(state, null, 2)
    await writeFile(tmpPath, json, 'utf-8')
    await rename(tmpPath, filePath)
  } catch (error) {
    // Best-effort cleanup of leftover .tmp file
    try {
      await stat(tmpPath)
      const {unlink} = await import('node:fs/promises')
      await unlink(tmpPath)
    } catch {
      // .tmp file doesn't exist or cleanup failed — ignore
    }

    throw new PipelineSerializeError(
      state.id,
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * Loads pipeline run state from disk and validates with Zod.
 * Throws PipelineNotFoundError if file doesn't exist.
 * Throws PipelineCorruptedError if JSON is invalid or fails schema validation.
 */
export async function loadPipelineRun(
  runId: string,
  projectDir: string = process.cwd(),
): Promise<PipelineRun> {
  validateRunId(runId)
  const filePath = getStatePath(projectDir, runId)

  let raw: string
  try {
    raw = await readFile(filePath, 'utf-8')
  } catch {
    throw new PipelineNotFoundError(runId)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new PipelineCorruptedError(runId, 'File contains invalid JSON')
  }

  const result = pipelineRunSchema.safeParse(parsed)
  if (!result.success) {
    throw new PipelineCorruptedError(
      runId,
      `Schema validation failed: ${result.error.message}`,
    )
  }

  return result.data as PipelineRun
}

/**
 * Lists all pipeline run IDs from disk (most recent first by file mtime).
 */
export async function listPipelineRuns(
  projectDir: string = process.cwd(),
): Promise<string[]> {
  const stateDir = getStateDir(projectDir)

  try {
    const files = await readdir(stateDir)
    const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))

    // Sort by mtime descending (most recent first)
    const withStats = await Promise.all(
      jsonFiles.map(async (f) => {
        const fileStat = await stat(join(stateDir, f))
        return {name: f, mtime: fileStat.mtimeMs}
      }),
    )
    withStats.sort((a, b) => b.mtime - a.mtime)

    return withStats.map((f) => f.name.replace('.json', ''))
  } catch {
    return [] // Directory doesn't exist yet — no runs
  }
}

/**
 * Checks if a pipeline run exists on disk.
 * Uses stat() for efficient existence check without reading file content.
 */
export async function pipelineRunExists(
  runId: string,
  projectDir: string = process.cwd(),
): Promise<boolean> {
  validateRunId(runId)
  const filePath = getStatePath(projectDir, runId)
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}
