import { Router } from 'express'
import { prisma } from '../db.js'
import { isLowStock } from '../lowStock.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
const maxInt = 2147483647
const pricePattern = /^\d{1,8}(\.\d{1,2})?$/

router.use(requireAuth)

// helpers
function isEmpty(value) {
  return value === undefined || value === null || value === ''
}

function parseWholeNumber(value) {
  const number = typeof value === 'string' ? Number(value.trim() || NaN) : value
  return Number.isInteger(number) && number >= 0 && number <= maxInt ? number : null
}

function parseProduct(body) {
  const { name, sku, description, quantity, costPrice, sellingPrice, lowStockThreshold } = body ?? {}

  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!cleanName) return { error: 'Name is required' }

  const cleanSku = typeof sku === 'string' ? sku.trim() : ''
  if (!cleanSku) return { error: 'SKU is required' }

  if (!isEmpty(description) && typeof description !== 'string') {
    return { error: 'Description must be text' }
  }

  const parsedQuantity = parseWholeNumber(quantity)
  if (parsedQuantity === null) {
    return { error: 'Quantity must be a whole number of 0 or more' }
  }

  for (const [label, price] of [['Cost price', costPrice], ['Selling price', sellingPrice]]) {
    if (!isEmpty(price) && !pricePattern.test(String(price).trim())) {
      return { error: `${label} must be 0 or more, with up to 2 decimals` }
    }
  }

  let parsedThreshold = null
  if (!isEmpty(lowStockThreshold)) {
    parsedThreshold = parseWholeNumber(lowStockThreshold)
    if (parsedThreshold === null) {
      return { error: 'Low stock threshold must be a whole number of 0 or more' }
    }
  }

  return {
    data: {
      name: cleanName,
      sku: cleanSku,
      description: description?.trim() || null,
      quantity: parsedQuantity,
      costPrice: isEmpty(costPrice) ? null : String(costPrice).trim(),
      sellingPrice: isEmpty(sellingPrice) ? null : String(sellingPrice).trim(),
      lowStockThreshold: parsedThreshold,
    },
  }
}

async function getDefaultThreshold(organizationId) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } })
  return organization.defaultLowStockThreshold
}

function handleWriteError(err, res) {
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A product with this SKU already exists' })
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Product not found' })
  }
  throw err
}

// routes
router.get('/', async (req, res) => {
  const { organizationId } = req.user
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const where = { organizationId }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [products, defaultThreshold] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: 'desc' } }),
    getDefaultThreshold(organizationId),
  ])

  res.json({
    products: products.map((product) => ({
      ...product,
      isLowStock: isLowStock(product, defaultThreshold),
    })),
  })
})

router.post('/', async (req, res) => {
  const { data, error } = parseProduct(req.body)
  if (error) return res.status(400).json({ error })

  try {
    const product = await prisma.product.create({
      data: { ...data, organizationId: req.user.organizationId, lastUpdatedBy: req.user.id },
    })
    res.status(201).json({ product })
  } catch (err) {
    handleWriteError(err, res)
  }
})

router.get('/:id', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  })

  if (!product) return res.status(404).json({ error: 'Product not found' })

  res.json({ product })
})

router.put('/:id', async (req, res) => {
  const { data, error } = parseProduct(req.body)
  if (error) return res.status(400).json({ error })

  try {
    const product = await prisma.product.update({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      data: { ...data, lastUpdatedBy: req.user.id },
    })
    res.json({ product })
  } catch (err) {
    handleWriteError(err, res)
  }
})

router.post('/:id/adjust', async (req, res) => {
  const { change, note } = req.body ?? {}
  const { organizationId } = req.user
  const where = { id: req.params.id, organizationId }

  if (!Number.isInteger(change) || change === 0 || Math.abs(change) > maxInt) {
    return res.status(400).json({ error: 'Change must be a whole number other than 0' })
  }
  if (!isEmpty(note) && (typeof note !== 'string' || note.length > 200)) {
    return res.status(400).json({ error: 'Note must be text of up to 200 characters' })
  }

  const { count } = await prisma.product.updateMany({
    where: { ...where, quantity: { gte: Math.max(-change, 0), lte: maxInt - Math.max(change, 0) } },
    data: {
      quantity: { increment: change },
      lastAdjustmentNote: note?.trim() || null,
      lastUpdatedBy: req.user.id,
    },
  })

  const product = await prisma.product.findFirst({ where })

  if (!product) return res.status(404).json({ error: 'Product not found' })
  if (count === 0) {
    return res.status(400).json({ error: change < 0 ? 'Stock cannot go below 0' : 'Quantity is too large' })
  }

  const defaultThreshold = await getDefaultThreshold(organizationId)
  res.json({ product: { ...product, isLowStock: isLowStock(product, defaultThreshold) } })
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.product.delete({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    })
    res.json({ ok: true })
  } catch (err) {
    handleWriteError(err, res)
  }
})

export default router
