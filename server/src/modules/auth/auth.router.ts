import { Request, Response, NextFunction, Router } from 'express'
import crypto from 'crypto'
import { DomainError } from '../../shared/errors'
import { success } from '../../shared/response'
import { requireString } from '../../shared/validation'
import * as authService from './auth.service'

const authRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

authRouter.get('/auth/state', (req: Request, res: Response, next: NextFunction) => {
  try {
    const setupRequired = authService.isSetupRequired()
    const securityQuestion = setupRequired ? undefined : authService.getSecurityQuestion()
    res.json(success({ setupRequired, securityQuestion }, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.post('/auth/setup', (req: Request, res: Response, next: NextFunction) => {
  try {
    const pin = requireString(req.body.pin, 'pin')
    const question = requireString(req.body.question, 'question')
    const answer = requireString(req.body.answer, 'answer')
    const data = authService.setupPin(pin, question, answer)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.post('/auth/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const pin = requireString(req.body.pin, 'pin')
    const clientIp = req.ip ?? null
    const userAgent = req.headers['user-agent'] ?? null
    const data = authService.login(pin, clientIp, userAgent)
    res.json(success(data, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.post('/auth/recover', (req: Request, res: Response, next: NextFunction) => {
  try {
    const answer = requireString(req.body.answer, 'answer')
    const newPin = requireString(req.body.newPin, 'newPin')
    const clientIp = req.ip ?? null
    const userAgent = req.headers['user-agent'] ?? null
    const data = authService.recover(answer, newPin, clientIp, userAgent)
    res.json(success(data, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.get('/auth/check', (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (!token || !authService.validateToken(token)) {
      res.status(401).json(success({ authenticated: false }, getRequestId(req)))
      return
    }
    res.json(success({ authenticated: true }, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.post('/auth/logout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (token) authService.logout(token)
    res.json(success({ ok: true }, getRequestId(req)))
  } catch (err) { next(err) }
})

function extractTokenHash(req: Request): string | null {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!token) return null
  return crypto.createHash('sha256').update(token).digest('hex')
}

authRouter.post('/auth/change-pin', (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenHash = extractTokenHash(req)
    if (!tokenHash || !authService.validateToken(req.headers.authorization!.slice(7))) {
      throw new DomainError('UNAUTHORIZED', 'Authentication required', 401)
    }
    const currentPin = requireString(req.body.current_pin, 'current_pin')
    const newPin = requireString(req.body.new_pin, 'new_pin')
    authService.changePin(currentPin, newPin, tokenHash)
    res.json(success({ ok: true }, getRequestId(req)))
  } catch (err) { next(err) }
})

authRouter.post('/auth/change-security', (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokenHash = extractTokenHash(req)
    if (!tokenHash || !authService.validateToken(req.headers.authorization!.slice(7))) {
      throw new DomainError('UNAUTHORIZED', 'Authentication required', 401)
    }
    const currentPin = requireString(req.body.current_pin, 'current_pin')
    const question = requireString(req.body.question, 'question')
    const answer = requireString(req.body.answer, 'answer')
    authService.changeSecurity(currentPin, question, answer)
    res.json(success({ ok: true }, getRequestId(req)))
  } catch (err) { next(err) }
})

export { authRouter }
