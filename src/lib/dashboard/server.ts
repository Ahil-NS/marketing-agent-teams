import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:http'
import {readFile, access} from 'node:fs/promises'
import {extname} from 'node:path'

import {createApiRouter} from './api-routes.js'
import {sseEmitter} from './sse-emitter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface DashboardServerOptions {
  projectRoot: string
  port?: number
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

/**
 * Resolve a static file path from the dashboard directories.
 */
async function resolveStaticFile(urlPath: string): Promise<{filePath: string; contentType: string} | null> {
  // __dirname resolves to the directory of the importing file.
  // In bundled output: dist/commands/ -> ../dashboard = dist/dashboard/
  // In dev (tsx): src/lib/dashboard/ -> ../../dashboard = src/dashboard/
  const staticDirs = [
    join(__dirname, '..', 'dashboard'),              // dist/commands/../dashboard = dist/dashboard/
    join(__dirname, '..', '..', 'dashboard'),         // src/lib/dashboard/../../dashboard = src/dashboard/
    join(__dirname, '..', '..', '..', 'src', 'dashboard'), // fallback: project root/src/dashboard/
  ]

  const safePath = urlPath.replace(/\.\./g, '').replace(/^\/+/, '')
  const fileName = safePath || 'index.html'

  for (const dir of staticDirs) {
    const filePath = join(dir, fileName)
    try {
      await access(filePath)
      const ext = extname(filePath)
      return {filePath, contentType: MIME_TYPES[ext] ?? 'application/octet-stream'}
    } catch {
      continue
    }
  }
  return null
}

/**
 * Starts a lightweight HTTP dashboard server (no Express dependency).
 * Uses Node.js built-in http module to serve static files + JSON API + SSE.
 */
export async function startDashboard(
  options: DashboardServerOptions,
): Promise<{port: number; close: () => void}> {
  const port = options.port ?? 3847
  const {projectRoot} = options
  const apiRouter = createApiRouter(projectRoot)

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const pathname = url.pathname

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // SSE endpoint
    if (pathname === '/api/events') {
      sseEmitter.addClient(res)
      return
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      try {
        await apiRouter(req, res, pathname, url)
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)}))
      }
      return
    }

    // Static files
    const staticFile = await resolveStaticFile(pathname)
    if (staticFile) {
      try {
        const content = await readFile(staticFile.filePath)
        res.writeHead(200, {'Content-Type': staticFile.contentType})
        res.end(content)
        return
      } catch {
        // Fall through to index.html
      }
    }

    // SPA fallback — serve index.html
    const indexFile = await resolveStaticFile('index.html')
    if (indexFile) {
      const content = await readFile(indexFile.filePath)
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end(content)
      return
    }

    res.writeHead(404, {'Content-Type': 'text/plain'})
    res.end('Dashboard files not found')
  })

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        port,
        close: () => server.close(),
      })
    })
  })
}
