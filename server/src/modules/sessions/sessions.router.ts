import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './sessions.service'

const sessionsRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

sessionsRouter.post('/tables/:tableId/sessions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableId = requirePositiveInt(req.params.tableId, 'tableId')
    const data = service.openSession(tableId)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

sessionsRouter.get('/sessions/:sessionId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.getSessionDetail(sessionId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

sessionsRouter.delete('/sessions/:sessionId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    service.cancelSession(sessionId)
    res.json(success(null, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { sessionsRouter }
