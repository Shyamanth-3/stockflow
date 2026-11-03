import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { loginAccountLimiter, loginIpLimiter, signupLimiter } from '../middleware/rateLimits.js'
import { readToken, requireAuth } from '../middleware/requireAuth.js'
import { isValidText } from '../validation.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const sevenDays = 7 * 24 * 60 * 60 * 1000
const dummyHash = await bcrypt.hash(randomUUID(), 10)
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
    isValidText(password, 72) &&
    password.length >= 8 &&
    Buffer.byteLength(password) <= 72 &&
    /\p{L}/u.test(password) &&
    /\p{Nd}/u.test(password)
  )
}

function cleanOrganizationName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
}

function toNameKey(name) {
  return name.replace(/\p{Cf}/gu, '').trim().toLowerCase()
}

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  )
  res.cookie('token', token, { ...cookieOptions, maxAge: sevenDays })
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, organizationName: user.organization.name }
}

// routes
router.post('/signup', signupLimiter, async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const password = req.body?.password
  const organizationName = cleanOrganizationName(req.body?.organizationName)
  const nameKey = toNameKey(organizationName)

  if (!isValidText(email, 254) || !emailPattern.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be 8 to 72 characters and include a letter and a number',
    })
  }
  if (!nameKey) {
    return res.status(400).json({ error: 'Organization name is required' })
  }
  if (!isValidText(organizationName, 100)) {
    return res.status(400).json({ error: 'Organization name must be text of up to 100 characters' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        organization: { create: { name: organizationName, nameKey } },
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

router.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  const email = cleanEmail(req.body?.email)
  const password = req.body?.password

  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const user = isValidText(email, 254)
    ? await prisma.user.findUnique({ where: { email }, include: { organization: true } })
    : null
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? dummyHash)

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect email or password' })
  }

  setAuthCookie(res, user)
  res.json({ user: toPublicUser(user) })
})

router.post('/logout', async (req, res) => {
  const token = readToken(req)

  if (token) {
    await prisma.user.updateMany({
      where: { id: token.userId, tokenVersion: token.tokenVersion },
      data: { tokenVersion: { increment: 1 } },
    })
  }

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
