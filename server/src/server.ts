import type { AddressInfo } from 'net'
import { app } from './app'
import { PORT } from './config/constants'
import { initDb } from './db/client'
import { runMigrations } from './db/migrate'

export function startServer(): Promise<number> {
  initDb()
  runMigrations()
  return new Promise((resolve) => {
    const srv = app.listen(PORT, '0.0.0.0', () => {
      const addr = srv.address() as AddressInfo
      const actualPort = addr.port
      console.log(`Server running on http://0.0.0.0:${actualPort}`)
      if (process.send) {
        process.send({ type: 'listening', port: actualPort })
      }
      resolve(actualPort)
    })
  })
}

// 独立运行 或 被 fork 时自动启动
if (require.main === module || process.send) {
  startServer()
}
