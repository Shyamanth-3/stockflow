import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { parseWholeNumber } from '../validation.js'

const router = Router()

router.use(requireAuth)

// routes
router.get('/', async (req, res) => {
  const organization = await prisma.organization.findUnique({
    where: { id: req.user.organizationId },
  })

  res.json({ defaultLowStockThreshold: organization.defaultLowStockThreshold })
})

router.put('/', async (req, res) => {
  const value = parseWholeNumber(req.body?.defaultLowStockThreshold)

  if (value === null) {
    return res.status(400).json({ error: 'Default threshold must be a whole number of 0 or more' })
  }

  const organization = await prisma.organization.update({
    where: { id: req.user.organizationId },
    data: { defaultLowStockThreshold: value },
  })

  res.json({ defaultLowStockThreshold: organization.defaultLowStockThreshold })
})

export default router
