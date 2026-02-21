import { getDb } from '../../db/client'

export interface AdminPinRow {
  id: number
  pin_hash: string
  pin_salt: string
  pin_algo: string
  security_question: string
  security_answer_hash: string
  security_answer_salt: string
  updated_at: string
}

export interface SessionRow {
  id: number
  token_hash: string
  created_at: string
  expires_at: string
  revoked_at: string | null
  client_ip: string | null
  user_agent: string | null
}

export function getAdminPin(): AdminPinRow | undefined {
  return getDb().prepare('SELECT * FROM admin_pin WHERE id = 1').get() as AdminPinRow | undefined
}

export function upsertAdminPin(
  pinHash: string, pinSalt: string,
  question: string, answerHash: string, answerSalt: string,
): void {
  getDb().prepare(`
    INSERT INTO admin_pin (id, pin_hash, pin_salt, security_question, security_answer_hash, security_answer_salt, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      pin_hash = excluded.pin_hash,
      pin_salt = excluded.pin_salt,
      security_question = excluded.security_question,
      security_answer_hash = excluded.security_answer_hash,
      security_answer_salt = excluded.security_answer_salt,
      updated_at = datetime('now')
  `).run(pinHash, pinSalt, question, answerHash, answerSalt)
}

export function createSession(
  tokenHash: string, expiresAt: string, clientIp: string | null, userAgent: string | null,
): number {
  const result = getDb().prepare(`
    INSERT INTO auth_session (token_hash, expires_at, client_ip, user_agent)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, expiresAt, clientIp, userAgent)
  return Number(result.lastInsertRowid)
}

export function findValidSession(tokenHash: string): SessionRow | undefined {
  return getDb().prepare(`
    SELECT * FROM auth_session
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')
  `).get(tokenHash) as SessionRow | undefined
}

export function revokeSession(tokenHash: string): void {
  getDb().prepare(`
    UPDATE auth_session SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL
  `).run(tokenHash)
}

export function revokeAllSessions(): void {
  getDb().prepare(`
    UPDATE auth_session SET revoked_at = datetime('now') WHERE revoked_at IS NULL
  `).run()
}

export function revokeAllSessionsExcept(tokenHash: string): void {
  getDb().prepare(`
    UPDATE auth_session SET revoked_at = datetime('now')
    WHERE revoked_at IS NULL AND token_hash != ?
  `).run(tokenHash)
}

export function cleanupExpiredSessions(): number {
  const result = getDb().prepare(`
    DELETE FROM auth_session WHERE expires_at <= datetime('now')
  `).run()
  return result.changes
}

export function updatePinHash(hash: string, salt: string): void {
  getDb().prepare(`
    UPDATE admin_pin SET pin_hash = ?, pin_salt = ?, updated_at = datetime('now') WHERE id = 1
  `).run(hash, salt)
}

export function updateSecurityQuestion(question: string, answerHash: string, answerSalt: string): void {
  getDb().prepare(`
    UPDATE admin_pin SET security_question = ?, security_answer_hash = ?, security_answer_salt = ?, updated_at = datetime('now') WHERE id = 1
  `).run(question, answerHash, answerSalt)
}
