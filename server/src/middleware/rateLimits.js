import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

const fifteenMinutes = 15 * 60 * 1000
const oneHour = 60 * 60 * 1000

function createLimiter(options) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
    skip: () => process.env.NODE_ENV !== 'production',
    ...options,
  })
}

export const loginIpLimiter = createLimiter({
  windowMs: fifteenMinutes,
  limit: 100,
  skipSuccessfulRequests: true,
})

export const loginAccountLimiter = createLimiter({
  windowMs: fifteenMinutes,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email).trim().toLowerCase().slice(0, 254)
    return `${ipKeyGenerator(req.ip)}:${email}`
  },
})

export const signupLimiter = createLimiter({
  windowMs: oneHour,
  limit: 30,
})
