import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import dashboardRoutes from './routes/dashboard.js'
import settingsRoutes from './routes/settings.js'

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set')
}

const app = express()
const port = process.env.PORT || 3001
const clientDist = path.join(import.meta.dirname, '../../client/dist')

app.use(express.json())
app.use(cookieParser())

// routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/settings', settingsRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// client
app.use(express.static(clientDist))

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

// errors
app.use((err, req, res, next) => {
  const status = err.status || 500
  if (status === 500) console.error(err)
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message })
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
