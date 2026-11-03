import { Router } from 'express'
import { prisma } from '../db.js'
import { lowStockWhere } from '../lowStock.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { productsFor } from '../tenant.js'

const router = Router()
const lowStockLimit = 100

router.get('/', requireAuth, async (req, res) => {
  const { organizationId } = req.user
  const products = productsFor(organizationId)
  const { defaultLowStockThreshold } = await prisma.organization.findUnique({
    where: { id: organizationId },
  })
  const where = lowStockWhere(defaultLowStockThreshold)

  const [totalProducts, unitRows, lowStockCount, lowStockItems] = await Promise.all([
    products.count(),
    prisma.$queryRaw`SELECT COALESCE(SUM("quantity"), 0)::float8 AS "total" FROM "Product" WHERE "organizationId" = ${organizationId}`,
    products.count({ where }),
    products.findMany({
      where,
      orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
      take: lowStockLimit,
      select: { id: true, name: true, sku: true, quantity: true, lowStockThreshold: true },
    }),
  ])

  res.json({
    totalProducts,
    totalUnits: unitRows[0].total,
    defaultLowStockThreshold,
    lowStockCount,
    lowStockItems,
  })
})

export default router
