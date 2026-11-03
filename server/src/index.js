import path from 'node:path'
import express from 'express'

const app = express()
const port = process.env.PORT || 3001
const clientDist = path.join(import.meta.dirname, '../../client/dist')

app.use(express.json())

// routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// client
app.use(express.static(clientDist))

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
