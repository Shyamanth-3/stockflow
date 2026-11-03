import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'

export function readToken(req) {
  try {
    return jwt.verify(req.cookies.token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return null
  }
}

export async function requireAuth(req, res, next) {
  const token = readToken(req)
  const user = token
    ? await prisma.user.findUnique({
        where: { id: token.userId },
        select: { id: true, email: true, organizationId: true, tokenVersion: true },
      })
    : null

  if (!user || user.tokenVersion !== token.tokenVersion) {
    return res.status(401).json({ error: 'Not logged in' })
  }

  req.user = { id: user.id, email: user.email, organizationId: user.organizationId }
  next()
}
