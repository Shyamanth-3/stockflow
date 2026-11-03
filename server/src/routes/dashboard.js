import { Router } from 'express'
import { prisma } from '../db.js'
import { isLowStock } from '../lowStock.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { organizationId } = req.user
  const [products, organization] = await Promise.all([
    prisma.product.findMany({ where: { organizationId }, orderBy: { quantity: 'asc' } }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ])
  const { defaultLowStockThreshold } = organization

  res.json({
    totalProducts: products.length,
    totalUnits: products.reduce((sum, product) => sum + product.quantity, 0),
    defaultLowStockThreshold,
    lowStockItems: products
      .filter((product) => isLowStock(product, defaultLowStockThreshold))
      .map(({ id, name, sku, quantity, lowStockThreshold }) => ({
        id,
        name,
        sku,
        quantity,
        lowStockThreshold,
      })),
  })
})

export default router
