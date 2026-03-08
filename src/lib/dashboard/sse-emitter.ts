import {EventEmitter} from 'node:events'
import type {ServerResponse} from 'node:http'

import type {OrchestratorEventData} from '../orchestrator/types.js'

/**
 * Bridges orchestrator events to SSE clients.
 * Multiple dashboard clients can connect simultaneously.
 */
export class SSEEmitter extends EventEmitter {
  private clients: Set<ServerResponse> = new Set()

  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Send initial connection event
    res.write(`data: ${JSON.stringify({type: 'connected', timestamp: new Date().toISOString()})}\n\n`)

    this.clients.add(res)

    res.on('close', () => {
      this.clients.delete(res)
    })
  }

  broadcast(event: OrchestratorEventData): void {
    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const client of this.clients) {
      try {
        client.write(data)
      } catch {
        this.clients.delete(client)
      }
    }
  }

  getClientCount(): number {
    return this.clients.size
  }
}

// Singleton instance for cross-module access
export const sseEmitter = new SSEEmitter()
