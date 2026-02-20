import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './history.service'

const historyRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

historyRouter.get('/history/sessions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.listClosedSessions(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

historyRouter.get('/history/sessions/:sessionId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.getClosedSessionDetail(sessionId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

historyRouter.post('/history/sessions/:sessionId/restore', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.restoreFromHistory(sessionId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

historyRouter.delete('/history/sessions/:sessionId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.deleteFromHistory(sessionId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { historyRouter }
