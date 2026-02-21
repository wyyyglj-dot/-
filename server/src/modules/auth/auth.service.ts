import crypto from 'crypto'
import { getDb } from '../../db/client'
import { DomainError } from '../../shared/errors'
import * as repo from './auth.repo'

const SESSION_TTL_HOURS = 72

const WEAK_PINS = new Set([
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
  '123456', '654321', '012345', '543210',
])

const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

// Token validation cache: avoids DB lookup on every authenticated request
const tokenCache = new Map<string, { valid: boolean; ts: number }>()
const TOKEN_CACHE_TTL = 60_000
const TOKEN_CACHE_MAX = 1000

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of tokenCache) {
    if (now - v.ts > TOKEN_CACHE_TTL) tokenCache.delete(k)
  }
}, 30_000).unref()

function hashPin(pin: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt ?? crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pin, salt, 64, SCRYPT_OPTS).toString('hex')
  return { hash, salt }
}

function verifyPin(pin: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(pin, salt, 64, SCRYPT_OPTS).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'))
}

function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

function isWeakPin(pin: string): boolean {
  return WEAK_PINS.has(pin)
}

function validatePin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) {
    throw new DomainError('INVALID_PIN', 'PIN must be exactly 6 digits')
  }
  if (isWeakPin(pin)) {
    throw new DomainError('WEAK_PIN', 'PIN is too simple, please choose a stronger one')
  }
}

function createSessionToken(clientIp: string | null, userAgent: string | null): string {
  const { raw, hash } = generateToken()
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000)
  const expiresAt = expires.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
  repo.createSession(hash, expiresAt, clientIp, userAgent)
  return raw
}

export function isSetupRequired(): boolean {
  return repo.getAdminPin() === undefined
}

export function getSecurityQuestion(): string | null {
  return repo.getAdminPin()?.security_question ?? null
}

export function setupPin(
  pin: string, question: string, answer: string,
): { token: string } {
  if (!isSetupRequired()) {
    throw new DomainError('ALREADY_SETUP', 'PIN has already been set up')
  }
  validatePin(pin)
  if (!question.trim()) throw new DomainError('VALIDATION_ERROR', 'Security question is required')
  if (!answer.trim()) throw new DomainError('VALIDATION_ERROR', 'Security answer is required')

  const { hash: pinHash, salt: pinSalt } = hashPin(pin)
  const normalizedAnswer = answer.trim().toLowerCase()
  const { hash: answerHash, salt: answerSalt } = hashPin(normalizedAnswer)
  repo.upsertAdminPin(pinHash, pinSalt, question.trim(), answerHash, answerSalt)

  const token = createSessionToken(null, null)
  return { token }
}

export function login(
  pin: string, clientIp: string | null, userAgent: string | null,
): { token: string } {
  const row = repo.getAdminPin()
  if (!row) throw new DomainError('NOT_SETUP', 'PIN has not been set up yet')
  if (!verifyPin(pin, row.pin_hash, row.pin_salt)) {
    throw new DomainError('INVALID_CREDENTIALS', 'Incorrect PIN', 401)
  }
  const token = createSessionToken(clientIp, userAgent)
  return { token }
}

export function recover(
  answer: string, newPin: string,
  clientIp: string | null, userAgent: string | null,
): { token: string } {
  const row = repo.getAdminPin()
  if (!row) throw new DomainError('NOT_SETUP', 'PIN has not been set up yet')

  const normalizedAnswer = answer.trim().toLowerCase()
  if (!verifyPin(normalizedAnswer, row.security_answer_hash, row.security_answer_salt)) {
    throw new DomainError('INVALID_ANSWER', 'Incorrect security answer', 401)
  }

  validatePin(newPin)
  const { hash: pinHash, salt: pinSalt } = hashPin(newPin)
  repo.upsertAdminPin(pinHash, pinSalt, row.security_question, row.security_answer_hash, row.security_answer_salt)
  repo.revokeAllSessions()
  tokenCache.clear()

  const token = createSessionToken(clientIp, userAgent)
  return { token }
}

export function logout(rawToken: string): void {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  repo.revokeSession(hash)
  tokenCache.delete(hash)
}

export function validateToken(rawToken: string): boolean {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const cached = tokenCache.get(hash)
  if (cached && Date.now() - cached.ts < TOKEN_CACHE_TTL) return cached.valid

  const valid = repo.findValidSession(hash) !== undefined
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    // Evict oldest 100 entries
    let count = 0
    for (const k of tokenCache.keys()) {
      tokenCache.delete(k)
      if (++count >= 100) break
    }
  }
  tokenCache.set(hash, { valid, ts: Date.now() })
  return valid
}

export function changePin(currentPin: string, newPin: string, currentTokenHash: string): void {
  const row = repo.getAdminPin()
  if (!row) throw new DomainError('NOT_SETUP', 'PIN has not been set up yet')
  if (!verifyPin(currentPin, row.pin_hash, row.pin_salt)) {
    throw new DomainError('INVALID_PIN', 'Current PIN is incorrect', 401)
  }
  validatePin(newPin)

  const { hash: pinHash, salt: pinSalt } = hashPin(newPin)
  const db = getDb()
  db.transaction(() => {
    repo.updatePinHash(pinHash, pinSalt)
    repo.revokeAllSessionsExcept(currentTokenHash)
  })()
  tokenCache.clear()
}

export function changeSecurity(currentPin: string, question: string, answer: string): void {
  const row = repo.getAdminPin()
  if (!row) throw new DomainError('NOT_SETUP', 'PIN has not been set up yet')
  if (!verifyPin(currentPin, row.pin_hash, row.pin_salt)) {
    throw new DomainError('INVALID_PIN', 'Current PIN is incorrect', 401)
  }
  if (!question.trim()) throw new DomainError('VALIDATION_ERROR', 'Security question is required')
  if (!answer.trim()) throw new DomainError('VALIDATION_ERROR', 'Security answer is required')

  const normalizedAnswer = answer.trim().toLowerCase()
  const { hash: answerHash, salt: answerSalt } = hashPin(normalizedAnswer)
  repo.updateSecurityQuestion(question.trim(), answerHash, answerSalt)
}
