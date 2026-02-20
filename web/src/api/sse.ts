type EventHandler = (data: any) => void

class SSEClient {
  private source: EventSource | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect(): void {
    if (this.source) return
    const token = localStorage.getItem('auth_token')
    const url = '/api/v1/events' + (token ? '?token=' + encodeURIComponent(token) : '')
    this.source = new EventSource(url)

    this.source.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data)
        this.emit(event, data)
      } catch { /* ignore parse errors */ }
    }

    this.source.onerror = () => {
      this.source?.close()
      this.source = null
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.source?.close()
    this.source = null
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach(fn => fn(data))
    this.handlers.get('*')?.forEach(fn => fn({ event, data }))
  }
}

export const sseClient = new SSEClient()
