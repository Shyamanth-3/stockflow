import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  try {
    const { userId, organizationId } = jwt.verify(req.cookies.token, process.env.JWT_SECRET)
    req.user = { id: userId, organizationId }
    next()
  } catch {
    res.status(401).json({ error: 'Not logged in' })
  }
}
