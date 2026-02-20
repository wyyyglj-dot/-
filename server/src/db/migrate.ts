import fs from 'fs'
import path from 'path'
import { getDb } from './client'

export function runMigrations(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const dir = path.join(__dirname, 'migrations')
  if (!fs.existsSync(dir)) return

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((r: any) => r.name)
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    console.log(`Migration applied: ${file}`)
  }
}
