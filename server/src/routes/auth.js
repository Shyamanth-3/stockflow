import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const sevenDays = 7 * 24 * 60 * 60 * 1000
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}

// helpers
function cleanEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 72 &&
    /[a-z]/i.test(password) &&
    /\d/.test(password)
  )
}

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { userId: user.id, organizationId: user.organizationId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  )
  res.cookie('token', token, { ...cookieOptions, maxAge: sevenDays })
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, organizationName: user.organization.name }
}

// routes
router.post('/signup', async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const password = req.body?.password
  const rawName = req.body?.organizationName
  const organizationName = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : ''

  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be 8 to 72 characters and include a letter and a number',
    })
  }
  if (!organizationName) {
    return res.status(400).json({ error: 'Organization name is required' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        organization: {
          create: { name: organizationName, nameKey: organizationName.toLowerCase() },
        },
      },
      include: { organization: true },
    })
    setAuthCookie(res, user)
    res.status(201).json({ user: toPublicUser(user) })
  } catch (err) {
    if (err.code === 'P2002') {
      const error = err.meta?.target?.includes('nameKey')
        ? 'An organization with this name already exists'
        : 'An account with this email already exists'
      return res.status(409).json({ error })
    }
    throw err
  }
})

router.post('/login', async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const password = req.body?.password

  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  })
  const isValid = user && (await bcrypt.compare(password, user.passwordHash))

  if (!isValid) {
    return res.status(401).json({ error: 'Incorrect email or password' })
  }

  setAuthCookie(res, user)
  res.json({ user: toPublicUser(user) })
})

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions)
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { organization: true },
  })

  if (!user) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  res.json({ user: toPublicUser(user) })
})

export default router
