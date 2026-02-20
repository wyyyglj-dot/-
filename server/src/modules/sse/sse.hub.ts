import { Response } from 'express'

export type SseEventName =
  | 'session.opened'
  | 'session.deleted'
  | 'ticket.created'
  | 'serving.updated'
  | 'checkout.completed'
  | 'table.updated'
  | 'menu.updated'

class SseHub {
  private clients = new Set<Response>()
  private heartbeat: NodeJS.Timeout

  constructor() {
    this.heartbeat = setInterval(() => {
      this.ping()
    }, 15000)
    this.heartbeat.unref()
  }

  register(res: Response): () => void {
    this.clients.add(res)
    res.write('retry: 5000\n')
    res.write('event: connected\n')
    res.write(`data: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`)

    return () => {
      this.clients.delete(res)
    }
  }

  broadcast(event: SseEventName, data: unknown): void {
    const msg = JSON.stringify({ event, data })

    for (const client of this.clients) {
      try {
        client.write(`data: ${msg}\n\n`)
      } catch (_err) {
        this.clients.delete(client)
      }
    }
  }

  private ping(): void {
    for (const client of this.clients) {
      try {
        client.write(`: ping ${Date.now()}\n\n`)
      } catch (_err) {
        this.clients.delete(client)
      }
    }
  }
}

export const sseHub = new SseHub()
