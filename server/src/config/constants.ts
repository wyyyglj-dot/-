import path from 'path'
import fs from 'fs'

interface AppConfig {
  dbPath?: string
}

export function getConfigPath(): string {
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'config.json')
  }
  return path.join('.', 'data', 'config.json')
}

function readConfig(): AppConfig {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return {}
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as AppConfig
  } catch {
    // config.json 格式无效，回退默认
  }
  return {}
}

function writeConfig(config: AppConfig): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH
  const config = readConfig()
  if (config.dbPath) return config.dbPath
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'diancan.db')
  }
  return './data/diancan.db'
}

export function updateDbPathConfig(newPath: string): void {
  const config = readConfig()
  config.dbPath = newPath
  writeConfig(config)
}

export const PORT = Number(process.env.PORT) || 3000
export const DB_PATH = resolveDbPath()
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
