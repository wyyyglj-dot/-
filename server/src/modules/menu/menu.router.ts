import { NextFunction, Request, Response, Router } from 'express'
import { success } from '../../shared/response'
import { requirePositiveInt } from '../../shared/validation'
import * as service from './menu.service'

const menuRouter = Router()

function getRequestId(req: Request): string {
  return (req as any).requestId || ''
}

menuRouter.get('/categories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.listCategories()
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.post('/categories', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.createCategory(req.body)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.patch('/categories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requirePositiveInt(req.params.id, 'id')
    const data = service.updateCategory(id, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.delete('/categories/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requirePositiveInt(req.params.id, 'id')
    const data = service.deleteCategory(id)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.get('/dishes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.listDishes(req.query as Record<string, unknown>)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.post('/dishes', (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = service.createDish(req.body)
    res.status(201).json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.patch('/dishes/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requirePositiveInt(req.params.id, 'id')
    const data = service.updateDish(id, req.body)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

menuRouter.delete('/dishes/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requirePositiveInt(req.params.id, 'id')
    const data = service.deleteDish(id)
    res.json(success(data, getRequestId(req)))
  } catch (err) {
    next(err)
  }
})

export { menuRouter }
