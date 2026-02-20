import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './tickets.service'

const ticketsRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

ticketsRouter.post('/sessions/:sessionId/tickets', (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = requirePositiveInt(req.params.sessionId, 'sessionId')
    const data = service.createTicket(sessionId, req.body)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

ticketsRouter.patch('/ticket-items/:itemId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = requirePositiveInt(req.params.itemId, 'itemId')
    const data = service.patchTicketItem(itemId, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { ticketsRouter }
