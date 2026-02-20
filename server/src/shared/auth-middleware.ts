import { Request, Response, NextFunction } from 'express'
import { fail } from './response'
import * as authService from '../modules/auth/auth.service'

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (authService.isSetupRequired()) return next()

  const authHeader = req.headers.authorization
  const queryToken = req.query.token
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (typeof queryToken === 'string' ? queryToken : undefined)

  if (!token) {
    const requestId = (req as any).requestId || ''
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required', requestId))
    return
  }

  if (!authService.validateToken(token)) {
    const requestId = (req as any).requestId || ''
    res.status(401).json(fail('UNAUTHORIZED', 'Invalid or expired token', requestId))
    return
  }

  next()
}
