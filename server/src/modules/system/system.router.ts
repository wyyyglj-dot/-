import { NextFunction, Request, Response, Router } from 'express'
import os from 'os'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { success } from '../../shared/response'
import { DomainError } from '../../shared/errors'
import { getDb, getDbPath, closeDb, reopenDb, withMaintenance } from '../../db/client'
import { updateDbPathConfig } from '../../config/constants'

const systemRouter = Router()

const uploadDir = path.join(os.tmpdir(), 'diancan-uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 512 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.db') {
      return cb(new DomainError('VALIDATION_ERROR', '仅允许上传 .db 文件'))
    }
    cb(null, true)
  },
})

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

// ---------- Access Control ----------

function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  return normalized === '127.0.0.1' || normalized === '::1'
}

function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_TOKEN
  if (token) {
    if (req.header('x-admin-token') === token) return next()
    return next(new DomainError('UNAUTHORIZED', '需要管理员令牌', 401))
  }
  if (isLoopbackIp(req.ip)) return next()
  return next(new DomainError('FORBIDDEN', '仅允许本机执行管理员操作', 403))
}

// ---------- LAN ----------

const VIRTUAL_NIC_PATTERNS = [
  /vmware/i, /virtualbox/i, /vboxnet/i, /docker/i, /wsl/i,
  /vethernet/i, /hyper-v/i, /hyperv/i,
]

function isVirtualNic(name: string): boolean {
  return VIRTUAL_NIC_PATTERNS.some((p) => p.test(name))
}

function isPrivateIpv4(addr: string): boolean {
  return /^192\.168\./.test(addr) || /^10\./.test(addr) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)
}

function collectLanIps(): Array<{ address: string; family: string; interface: string }> {
  const nets = os.networkInterfaces()
  const results: Array<{ address: string; family: string; interface: string }> = []

  for (const [iface, infos] of Object.entries(nets)) {
    if (!infos || isVirtualNic(iface)) continue
    for (const info of infos) {
      if (info.internal || info.family !== 'IPv4') continue
      if (info.address.startsWith('127.') || info.address.startsWith('169.254.')) continue
      if (!isPrivateIpv4(info.address)) continue
      results.push({ address: info.address, family: info.family, interface: iface })
    }
  }
  return results
}

function pickPrimaryIp(ips: Array<{ address: string }>): string | null {
  return (
    ips.find((ip) => /^192\.168\./.test(ip.address)) ??
    ips.find((ip) => /^10\./.test(ip.address)) ??
    ips.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip.address))
  )?.address ?? null
}

systemRouter.get('/system/lan', (req: Request, res: Response, next: NextFunction) => {
  try {
    const ips = collectLanIps()
    res.json(success({ primaryIp: pickPrimaryIp(ips), ips, hostname: os.hostname() }, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

// ---------- Database Management ----------

systemRouter.get('/system/db', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbPath = getDbPath()
    const stat = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null
    const sizeBytes = stat?.size ?? 0
    const lastModified = stat?.mtime.toISOString() ?? null
    let walMode: string | null = null
    try { walMode = getDb().pragma('journal_mode', { simple: true }) as string } catch { /* ignore */ }
    res.json(success({ path: dbPath, sizeBytes, lastModified, walMode }, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

systemRouter.post('/system/db/backup', requireAdmin, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetPath } = req.body as { targetPath?: string }
    const db = getDb()

    if (targetPath && targetPath.trim()) {
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      db.prepare('VACUUM INTO ?').run(targetPath)
      res.json(success({ path: targetPath }, getRequestId(req)))
      return
    }

    // Web: VACUUM INTO temp file, then stream download
    const tempPath = path.join(os.tmpdir(), `diancan-backup-${Date.now()}.db`)
    db.prepare('VACUUM INTO ?').run(tempPath)
    res.download(tempPath, `diancan-backup-${new Date().toISOString().split('T')[0]}.db`, (err) => {
      fs.rmSync(tempPath, { force: true })
      if (err && !res.headersSent) next(err)
    })
  } catch (err) {
    next(err)
  }
})

systemRouter.post(
  '/system/db/restore',
  requireAdmin,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    const reqId = getRequestId(req)
    const uploadedFile = (req as any).file?.path as string | undefined

    try {
      const { sourcePath } = req.body as { sourcePath?: string }
      const source = (sourcePath && sourcePath.trim()) ? sourcePath : uploadedFile
      if (!source) throw new DomainError('VALIDATION_ERROR', 'sourcePath 或上传文件不能为空')

      const currentPath = getDbPath()
      if (path.resolve(source) === path.resolve(currentPath)) {
        throw new DomainError('VALIDATION_ERROR', '源文件不能与当前数据库相同')
      }
      if (!fs.existsSync(source)) {
        throw new DomainError('FILE_NOT_FOUND', '源数据库文件不存在', 404)
      }

      let backupPath: string | null = null

      await withMaintenance(async () => {
        closeDb()

        // 备份现有数据库
        if (fs.existsSync(currentPath)) {
          backupPath = `${currentPath}.bak-${Date.now()}`
          fs.copyFileSync(currentPath, backupPath)
        }

        try {
          const dir = path.dirname(currentPath)
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
          fs.copyFileSync(source, currentPath)
          // 清除旧 WAL/SHM 文件
          fs.rmSync(`${currentPath}-wal`, { force: true })
          fs.rmSync(`${currentPath}-shm`, { force: true })

          reopenDb(currentPath)
          const integrity = getDb().pragma('integrity_check', { simple: true }) as string
          if (integrity !== 'ok') {
            throw new DomainError('INTEGRITY_FAIL', '数据库完整性校验失败', 500)
          }
        } catch (err) {
          // 回滚：恢复备份
          if (backupPath && fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, currentPath)
            fs.rmSync(`${currentPath}-wal`, { force: true })
            fs.rmSync(`${currentPath}-shm`, { force: true })
          }
          try { reopenDb(currentPath) } catch { /* 回滚尽力而为 */ }
          throw err
        }
      })

      res.json(success({ path: currentPath }, reqId))
    } catch (err) {
      next(err)
    } finally {
      if (uploadedFile) fs.rmSync(uploadedFile, { force: true })
    }
  },
)

systemRouter.post('/system/db/migrate', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  const reqId = getRequestId(req)
  try {
    const { newPath, mode = 'move' } = req.body as { newPath?: string; mode?: string }
    if (!newPath || !newPath.trim()) throw new DomainError('VALIDATION_ERROR', 'newPath 不能为空')
    if (mode !== 'move' && mode !== 'copy') {
      throw new DomainError('VALIDATION_ERROR', 'mode 必须为 move 或 copy')
    }

    const currentPath = getDbPath()
    const dbFileName = path.basename(currentPath) || 'diancan.db'
    let targetPath = newPath.trim()
    // 前端 Electron 传入目录路径时，自动追加数据库文件名
    if (path.extname(targetPath).toLowerCase() !== '.db') {
      targetPath = path.join(targetPath, dbFileName)
    }
    if (path.resolve(targetPath) === path.resolve(currentPath)) {
      throw new DomainError('VALIDATION_ERROR', '新路径不能与当前路径相同')
    }

    await withMaintenance(async () => {
      closeDb()

      if (!fs.existsSync(currentPath)) {
        throw new DomainError('FILE_NOT_FOUND', '当前数据库文件不存在', 404)
      }

      const destDir = path.dirname(targetPath)
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
      if (fs.existsSync(targetPath)) {
        throw new DomainError('CONFLICT', '目标路径已存在文件', 409)
      }

      try {
        fs.copyFileSync(currentPath, targetPath)
        updateDbPathConfig(targetPath)
        reopenDb(targetPath)

        const integrity = getDb().pragma('integrity_check', { simple: true }) as string
        if (integrity !== 'ok') {
          throw new DomainError('INTEGRITY_FAIL', '数据库完整性校验失败', 500)
        }

        if (mode === 'move') {
          fs.rmSync(currentPath, { force: true })
          fs.rmSync(`${currentPath}-wal`, { force: true })
          fs.rmSync(`${currentPath}-shm`, { force: true })
        }
      } catch (err) {
        // 回滚
        try { updateDbPathConfig(currentPath) } catch { /* ignore */ }
        try { fs.rmSync(targetPath, { force: true }) } catch { /* ignore */ }
        try { reopenDb(currentPath) } catch { /* ignore */ }
        throw err
      }
    })

    res.json(success({ oldPath: currentPath, newPath: targetPath, mode }, reqId))
  } catch (err) {
    next(err)
  }
})

export { systemRouter }
