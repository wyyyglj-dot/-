import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import * as service from './stats.service'

const statsRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

statsRouter.get('/stats/revenue', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getRevenue(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

statsRouter.get('/stats/rankings/quantity', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getQuantityRanking(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

statsRouter.get('/stats/rankings/revenue', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getRevenueRanking(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

statsRouter.get('/stats/rankings/profit', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getProfitRanking(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

statsRouter.get('/stats/dashboard', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.getDashboard(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { statsRouter }
