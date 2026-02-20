import { NextFunction, Request, Response, Router } from 'express'
import { sseHub } from './sse.hub'

const sseRouter = Router()

sseRouter.get('/events', (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders()
    }

    const unregister = sseHub.register(res)
    req.on('close', unregister)
    req.on('end', unregister)
  } catch (err) {
    next(err)
  }
})

export { sseRouter }
