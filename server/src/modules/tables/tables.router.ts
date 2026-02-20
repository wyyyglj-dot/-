import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './tables.service'

const tablesRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

tablesRouter.get('/tables', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.listTables()
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

tablesRouter.get('/tables/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.listTableSummaries()
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

tablesRouter.get('/tables/:tableId/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableId = requirePositiveInt(req.params.tableId, 'tableId')
    const data = service.getSingleTableSummary(tableId)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

tablesRouter.post('/tables', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.createTable(req.body)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

tablesRouter.patch('/tables/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requirePositiveInt(req.params.id, 'id')
    const data = service.updateTable(id, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { tablesRouter }
