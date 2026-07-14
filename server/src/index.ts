import 'dotenv/config'
import cookieParser from 'cookie-parser'
import express from 'express'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'

export const app = express()

app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT ?? 4000)
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`ES-Market API listening on http://localhost:${port}`))
}
