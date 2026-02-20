import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './checkout.service'

const checkoutRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

checkoutRouter.post('/sessions/:sessionId/checkout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.checkoutSession(sessionId, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { checkoutRouter }
