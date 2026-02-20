import path from 'path'
import express from 'express'
import cors from 'cors'
import { CORS_ORIGIN } from './config/constants'
import { errorHandler } from './shared/errors'
import { requestId } from './shared/middleware'
import { maintenanceMiddleware } from './db/client'
import { menuRouter } from './modules/menu/menu.router'
import { tablesRouter } from './modules/tables/tables.router'
import { sessionsRouter } from './modules/sessions/sessions.router'
import { ticketsRouter } from './modules/tickets/tickets.router'
import { servingRouter } from './modules/serving/serving.router'
import { checkoutRouter } from './modules/checkout/checkout.router'
import { statsRouter } from './modules/stats/stats.router'
import { historyRouter } from './modules/history/history.router'
import { sseRouter } from './modules/sse/sse.router'
import { systemRouter } from './modules/system/system.router'
import { authRouter } from './modules/auth/auth.router'
import { authMiddleware } from './shared/auth-middleware'

const app = express()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())
app.use(requestId)
app.use(maintenanceMiddleware)

app.use('/api/v1', authRouter)
app.use('/api/v1', authMiddleware)

app.use('/api/v1', menuRouter)
app.use('/api/v1', tablesRouter)
app.use('/api/v1', sessionsRouter)
app.use('/api/v1', ticketsRouter)
app.use('/api/v1', servingRouter)
app.use('/api/v1', checkoutRouter)
app.use('/api/v1', statsRouter)
app.use('/api/v1', historyRouter)
app.use('/api/v1', sseRouter)
app.use('/api/v1', systemRouter)

if (process.env.NODE_ENV === 'production') {
  const webRoot = path.join(__dirname, '../../web-dist')
  app.use(express.static(webRoot))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(webRoot, 'index.html'))
  })
}

app.use(errorHandler)

export { app }
