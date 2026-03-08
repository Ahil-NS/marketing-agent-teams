import type {IncomingMessage, ServerResponse} from 'node:http'
import {readFile, unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {spawn} from 'node:child_process'

import {listPipelineRuns, loadPipelineRun} from '../orchestrator/state-serializer.js'
import {ReviewQueue} from '../review-queue/review-queue.js'
import {ContextManager} from '../context/context-manager.js'
import {CampaignStore} from '../history/campaign-store.js'
import {ContentStore} from '../history/content-store.js'

type ApiHandler = (req: IncomingMessage, res: ServerResponse, pathname: string, url: URL) => Promise<void>

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {'Content-Type': 'application/json'})
  res.end(JSON.stringify(data))
}

async function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(body ? JSON.parse(body) as Record<string, unknown> : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function extractParam(pathname: string, pattern: string): string | null {
  const patternParts = pattern.split('/')
  const pathParts = pathname.split('/')
  if (patternParts.length !== pathParts.length) return null
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) continue
    if (patternParts[i] !== pathParts[i]) return null
  }
  const paramIndex = patternParts.findIndex((p) => p.startsWith(':'))
  return paramIndex >= 0 ? pathParts[paramIndex] : null
}

/** Track spawned pipeline child processes for cleanup. */
const activePids = new Map<number, {startedAt: string; platforms: string[]}>()
/** Debounce: reject POST /api/runs if one was spawned within this window. */
let lastRunSpawnedAt = 0
const RUN_SPAWN_COOLDOWN_MS = 5_000

/** Spawn `mat run --resume <runId>` as a detached process. Returns true if spawned. */
function tryResumePipeline(runId: string, projectRoot: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const binPath = join(projectRoot, 'bin', 'mat')
      const cleanEnv = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')),
      )
      const child = spawn('node', [binPath, 'run', '--resume', runId], {
        cwd: projectRoot,
        stdio: 'ignore',
        detached: true,
        env: cleanEnv,
      })
      child.unref()
      resolve(true)
    } catch {
      resolve(false)
    }
  })
}

export function createApiRouter(projectRoot: string): ApiHandler {
  const reviewQueue = new ReviewQueue(projectRoot)
  const contextManager = new ContextManager(projectRoot)
  const campaignStore = new CampaignStore(projectRoot)
  const contentStore = new ContentStore(projectRoot)

  return async (req, res, pathname, url) => {
    const method = req.method ?? 'GET'

    try {
      // GET /api/runs
      if (method === 'GET' && pathname === '/api/runs') {
        const runIds = await listPipelineRuns(projectRoot)
        const runs = await Promise.all(
          runIds.map(async (id) => {
            try {
              const run = await loadPipelineRun(id, projectRoot)
              return {
                id: run.id,
                status: run.status,
                currentStage: run.currentStage,
                platforms: run.config?.platforms ?? [],
                startedAt: run.startedAt,
                updatedAt: run.updatedAt,
                totalCost: run.budget?.spent ?? 0,
                duration: run.startedAt && run.updatedAt
                  ? new Date(run.updatedAt).getTime() - new Date(run.startedAt).getTime()
                  : null,
              }
            } catch {
              return {id, status: 'corrupted', currentStage: null, platforms: [], startedAt: null, updatedAt: null, totalCost: 0, duration: null}
            }
          }),
        )
        json(res, runs)
        return
      }

      // GET /api/runs/:id
      if (method === 'GET' && pathname.match(/^\/api\/runs\/[^/]+$/) && !pathname.endsWith('/active')) {
        const id = pathname.split('/').pop()!
        const run = await loadPipelineRun(id, projectRoot)
        json(res, run)
        return
      }

      // POST /api/runs/:id/resume — Resume a paused pipeline
      if (method === 'POST' && pathname.match(/^\/api\/runs\/[^/]+\/resume$/)) {
        const id = extractParam(pathname, '/api/runs/:id/resume')!
        try {
          const run = await loadPipelineRun(id, projectRoot)
          if (run.status !== 'paused') {
            json(res, {error: `Pipeline is '${run.status}', not 'paused'. Cannot resume.`}, 400)
            return
          }
          const resumed = await tryResumePipeline(id, projectRoot)
          json(res, {status: resumed ? 'resuming' : 'failed', runId: id})
        } catch {
          json(res, {error: 'Run not found'}, 404)
        }
        return
      }

      // POST /api/runs — Actually start a pipeline run
      if (method === 'POST' && pathname === '/api/runs') {
        const body = await parseBody(req)
        const platforms = (body.platforms as string[] | undefined) ?? ['reddit']
        const dryRun = body.dryRun !== false // default true
        const mode = (body.mode as string) ?? 'full'
        const posts = typeof body.posts === 'number' ? body.posts : 1

        // Use `mat create` for workflow modes, `mat run` for basic runs
        const useCreate = mode !== 'full' || body.idea || body.topic
        const args = useCreate ? ['create'] : ['run']
        for (const p of platforms) {
          args.push('-p', p)
        }
        if (dryRun) {
          args.push('--dry-run')
        }
        if (posts > 1) {
          args.push('--posts', String(posts))
        }

        // Mode-specific flags for `mat create`
        if (useCreate) {
          if (mode === 'optimize') {
            args.push('--optimize')
            if (body.topic) args.push('--topic', String(body.topic))
            if (body.niche) args.push('--niche', String(body.niche))
            if (body.audience) args.push('--audience', String(body.audience))
            if (body.videoDescription) args.push('--video-description', String(body.videoDescription))
            if (body.duration) args.push('--duration', String(body.duration))
          } else if (body.idea) {
            args.push('--idea', String(body.idea))
          }
        }

        // Cooldown guard — prevent duplicate runs from rapid/double submissions
        const now = Date.now()
        if (now - lastRunSpawnedAt < RUN_SPAWN_COOLDOWN_MS) {
          json(res, {error: 'A pipeline was just started. Please wait a few seconds.'}, 429)
          return
        }

        // Resolve the bin/mat path
        const binPath = join(projectRoot, 'bin', 'mat')

        // Spawn fully detached — stdio ignored so the server doesn't block
        // Strip ALL Claude env vars to avoid nested session detection
        const cleanEnv = Object.fromEntries(
          Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')),
        )
        const child = spawn('node', [binPath, ...args], {
          cwd: projectRoot,
          stdio: 'ignore',
          detached: true,
          env: cleanEnv,
        })

        const pid = child.pid
        lastRunSpawnedAt = Date.now()

        // Track the child process for cleanup
        if (pid) {
          activePids.set(pid, {startedAt: new Date().toISOString(), platforms})
          child.on('exit', () => { activePids.delete(pid) })
        }

        child.unref()

        // Respond immediately — the dashboard will poll for the new run
        json(res, {status: 'started', pid, platforms, dryRun, mode})
        return
      }

      // DELETE /api/runs/:id — Delete a single run
      if (method === 'DELETE' && pathname.match(/^\/api\/runs\/[^/]+$/)) {
        const id = pathname.split('/').pop()!
        // Validate it's a UUID
        if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
          json(res, {error: 'Invalid run ID'}, 400)
          return
        }
        const filePath = join(projectRoot, '.mat', 'state', 'pipeline-runs', `${id}.json`)
        try {
          await unlink(filePath)
          json(res, {deleted: id})
        } catch {
          json(res, {error: 'Run not found'}, 404)
        }
        return
      }

      // DELETE /api/runs — Delete multiple runs by status filter
      if (method === 'DELETE' && pathname === '/api/runs') {
        const body = await parseBody(req)
        const statusFilter = body.status as string | undefined // 'failed', 'corrupted', 'all'
        const runIds = await listPipelineRuns(projectRoot)
        const deleted: string[] = []

        for (const id of runIds) {
          try {
            const run = await loadPipelineRun(id, projectRoot)
            const shouldDelete = statusFilter === 'all'
              || (statusFilter === 'failed' && run.status === 'failed')
              || (statusFilter === 'corrupted' && false) // corrupted runs can't be loaded
              || (!statusFilter && (run.status === 'failed' || run.status === 'cancelled'))
            if (shouldDelete) {
              const filePath = join(projectRoot, '.mat', 'state', 'pipeline-runs', `${id}.json`)
              await unlink(filePath)
              deleted.push(id)
            }
          } catch {
            // Corrupted/unreadable runs — delete if requested
            if (statusFilter === 'corrupted' || statusFilter === 'all') {
              const filePath = join(projectRoot, '.mat', 'state', 'pipeline-runs', `${id}.json`)
              try {
                await unlink(filePath)
                deleted.push(id)
              } catch { /* skip */ }
            }
          }
        }

        json(res, {deleted, count: deleted.length})
        return
      }

      // GET /api/review
      if (method === 'GET' && pathname === '/api/review') {
        const filter: Record<string, string> = {}
        const platform = url.searchParams.get('platform')
        const status = url.searchParams.get('status')
        if (platform) filter.platform = platform
        if (status) filter.status = status
        const items = await reviewQueue.list(Object.keys(filter).length > 0 ? filter : undefined)
        json(res, items)
        return
      }

      // POST /api/review/:id/approve
      if (method === 'POST' && pathname.match(/^\/api\/review\/[^/]+\/approve$/)) {
        const id = extractParam(pathname, '/api/review/:id/approve')!
        const body = await parseBody(req)
        const item = await reviewQueue.approve(id, body.notes as string | undefined)

        // Check if all items for this run are now approved — auto-resume pipeline
        let autoResumed = false
        if (item.runId) {
          const runItems = await reviewQueue.list({runId: item.runId})
          const allApproved = runItems.length > 0 && runItems.every((i) => i.status === 'approved')
          if (allApproved) {
            autoResumed = await tryResumePipeline(item.runId, projectRoot)
          }
        }

        json(res, {...item, autoResumed})
        return
      }

      // POST /api/review/:id/reject
      if (method === 'POST' && pathname.match(/^\/api\/review\/[^/]+\/reject$/)) {
        const id = extractParam(pathname, '/api/review/:id/reject')!
        const body = await parseBody(req)
        const item = await reviewQueue.reject(id, (body.reason as string) ?? 'Rejected via dashboard', body.feedback as string | undefined)
        json(res, item)
        return
      }

      // POST /api/review/:id/edit
      if (method === 'POST' && pathname.match(/^\/api\/review\/[^/]+\/edit$/)) {
        const id = extractParam(pathname, '/api/review/:id/edit')!
        const body = await parseBody(req)
        const edits = body.edits as Record<string, string> | undefined
        if (!edits || Object.keys(edits).length === 0) {
          json(res, {error: 'edits object required'}, 400)
          return
        }
        const item = await reviewQueue.edit(id, edits, body.notes as string | undefined)
        json(res, item)
        return
      }

      // GET /api/context
      if (method === 'GET' && pathname === '/api/context') {
        const content = await contextManager.getContext()
        json(res, {
          exists: content !== null,
          content: content ?? '',
          path: contextManager.getContextPath(),
        })
        return
      }

      // PUT /api/context
      if (method === 'PUT' && pathname === '/api/context') {
        const body = await parseBody(req)
        if (!body.content) {
          json(res, {error: 'content field required'}, 400)
          return
        }
        await contextManager.saveContext(body.content as string)
        json(res, {status: 'saved', path: contextManager.getContextPath()})
        return
      }

      // GET /api/history
      if (method === 'GET' && pathname === '/api/history') {
        const campaigns = await campaignStore.list()
        const platform = url.searchParams.get('platform')
        if (platform) {
          json(res, campaigns.filter((c) => c.platforms.includes(platform)))
        } else {
          json(res, campaigns)
        }
        return
      }

      // GET /api/history/:id/content
      if (method === 'GET' && pathname.match(/^\/api\/history\/[^/]+\/content$/)) {
        const id = extractParam(pathname, '/api/history/:id/content')!
        const content = await contentStore.getByCampaign(id)
        json(res, content)
        return
      }

      // GET /api/config
      if (method === 'GET' && pathname === '/api/config') {
        const configPath = join(projectRoot, '.mat', 'config.yaml')
        try {
          const content = await readFile(configPath, 'utf-8')
          json(res, {exists: true, content})
        } catch {
          json(res, {exists: false, content: ''})
        }
        return
      }

      // 404 for unknown API routes
      json(res, {error: `Unknown API route: ${method} ${pathname}`}, 404)
    } catch (error) {
      json(res, {error: error instanceof Error ? error.message : String(error)}, 500)
    }
  }
}
