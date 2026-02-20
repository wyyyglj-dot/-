import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { Request, Response, NextFunction } from 'express'
import { DB_PATH } from '../config/constants'
import { fail } from '../shared/response'

let db: Database.Database | null = null
let currentDbPath = DB_PATH
let maintenanceDepth = 0

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getDbPath(): string {
  return currentDbPath
}

export function isMaintenanceMode(): boolean {
  return maintenanceDepth > 0
}

export function initDb(): void {
  const dir = path.dirname(currentDbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(currentDbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
}

export function closeDb(): void {
  if (!db) return
  try {
    db.pragma('wal_checkpoint(FULL)')
  } finally {
    db.close()
    db = null
  }
}

export function reopenDb(nextPath?: string): void {
  if (db) closeDb()
  const target = nextPath ?? currentDbPath
  const dir = path.dirname(target)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(target)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  currentDbPath = target
}

export async function withMaintenance<T>(fn: () => Promise<T> | T): Promise<T> {
  maintenanceDepth += 1
  try {
    return await fn()
  } finally {
    maintenanceDepth = Math.max(maintenanceDepth - 1, 0)
  }
}

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isMaintenanceMode()) return next()
  const requestId = (req as any).requestId || ''
  res.status(503).json(fail('MAINTENANCE', '系统维护中，请稍后重试', requestId))
}
