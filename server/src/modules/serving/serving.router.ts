import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './serving.service'

const servingRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

servingRouter.get('/serving-queue', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getServingQueue()
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

servingRouter.get('/served-items', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getServedItems()
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

servingRouter.post('/ticket-items/:itemId/serve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = requirePositiveInt(req.params.itemId, 'itemId')
    const data = service.serveTicketItem(itemId, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

servingRouter.post('/ticket-items/:itemId/unserve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = requirePositiveInt(req.params.itemId, 'itemId')
    const data = service.unserveTicketItem(itemId, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { servingRouter }
