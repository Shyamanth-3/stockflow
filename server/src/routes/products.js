import { Router } from 'express'
import { prisma } from '../db.js'
import { isLowStock } from '../lowStock.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { productsFor } from '../tenant.js'
import { isValidText, maxInt, parseWholeNumber } from '../validation.js'

const router = Router()
const pageSize = 50
const pricePattern = /^\d{1,8}(\.\d{1,2})?$/
const textLimits = { name: 200, sku: 100, description: 2000, search: 200, note: 200 }

router.use(requireAuth)

router.param('id', (req, res, next, id) => {
  if (!isValidText(id, 100)) return res.status(404).json({ error: 'Product not found' })
  next()
})

// helpers
function isEmpty(value) {
  return value === undefined || value === null || value === ''
}

function isValidPrice(price) {
  return (
    ['string', 'number'].includes(typeof price) && pricePattern.test(String(price).trim())
  )
}

function parseProduct(body) {
  const { name, sku, description, quantity, costPrice, sellingPrice, lowStockThreshold } = body ?? {}

  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!cleanName) return { error: 'Name is required' }
  if (!isValidText(cleanName, textLimits.name)) {
    return { error: `Name must be text of up to ${textLimits.name} characters` }
  }

  const cleanSku = typeof sku === 'string' ? sku.trim() : ''
  if (!cleanSku) return { error: 'SKU is required' }
  if (!isValidText(cleanSku, textLimits.sku)) {
    return { error: `SKU must be text of up to ${textLimits.sku} characters` }
  }

  if (!isEmpty(description) && !isValidText(description, textLimits.description)) {
    return { error: `Description must be text of up to ${textLimits.description} characters` }
  }

  const parsedQuantity = parseWholeNumber(quantity)
  if (parsedQuantity === null) {
    return { error: 'Quantity must be a whole number of 0 or more' }
  }

  for (const [label, price] of [['Cost price', costPrice], ['Selling price', sellingPrice]]) {
    if (!isEmpty(price) && !isValidPrice(price)) {
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

function sendDuplicateSku(res) {
  return res.status(409).json({ error: 'A product with this SKU already exists' })
}

function sendNotFound(res) {
  return res.status(404).json({ error: 'Product not found' })
}

function sendConflict(res) {
  return res.status(409).json({
    error: 'This product changed after you opened it. Reload the page and try again.',
  })
}

// routes
router.get('/', async (req, res) => {
  const { organizationId } = req.user
  const products = productsFor(organizationId)
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const page = parseWholeNumber(req.query.page) || 1

  if (!isValidText(search, textLimits.search)) {
    return res.status(400).json({ error: `Search must be text of up to ${textLimits.search} characters` })
  }

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {}

  const [items, total, defaultThreshold] = await Promise.all([
    products.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    products.count({ where }),
    getDefaultThreshold(organizationId),
  ])

  res.json({
    products: items.map((product) => ({
      ...product,
      isLowStock: isLowStock(product, defaultThreshold),
    })),
    total,
    page,
    pageSize,
  })
})

router.post('/', async (req, res) => {
  const { data, error } = parseProduct(req.body)
  if (error) return res.status(400).json({ error })

  try {
    const product = await productsFor(req.user.organizationId).create({
      data: { ...data, lastUpdatedBy: req.user.id },
    })
    res.status(201).json({ product })
  } catch (err) {
    if (err.code === 'P2002') return sendDuplicateSku(res)
    throw err
  }
})

router.get('/:id', async (req, res) => {
  const product = await productsFor(req.user.organizationId).findFirst({
    where: { id: req.params.id },
    include: { updatedByUser: { select: { email: true } } },
  })

  if (!product) return sendNotFound(res)

  res.json({ product })
})

router.put('/:id', async (req, res) => {
  const { data, error } = parseProduct(req.body)
  if (error) return res.status(400).json({ error })

  const expectedUpdatedAt = isEmpty(req.body.updatedAt) ? null : new Date(req.body.updatedAt)
  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) {
    return res.status(400).json({ error: 'Updated time is not valid' })
  }

  const products = productsFor(req.user.organizationId)
  const current = await products.findFirst({ where: { id: req.params.id } })

  if (!current) return sendNotFound(res)
  if (expectedUpdatedAt && expectedUpdatedAt.getTime() !== current.updatedAt.getTime()) {
    return sendConflict(res)
  }

  try {
    const [product] = await products.updateManyAndReturn({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        ...data,
        lastUpdatedBy: req.user.id,
        ...(data.quantity === current.quantity ? {} : { lastAdjustmentNote: null }),
      },
    })

    if (!product) return sendConflict(res)

    res.json({ product })
  } catch (err) {
    if (err.code === 'P2002') return sendDuplicateSku(res)
    throw err
  }
})

router.post('/:id/adjust', async (req, res) => {
  const { change, note } = req.body ?? {}
  const { organizationId } = req.user
  const products = productsFor(organizationId)

  if (!Number.isInteger(change) || change === 0 || Math.abs(change) > maxInt) {
    return res.status(400).json({ error: 'Change must be a whole number other than 0' })
  }
  if (!isEmpty(note) && !isValidText(note, textLimits.note)) {
    return res.status(400).json({ error: `Note must be text of up to ${textLimits.note} characters` })
  }

  const cleanNote = note?.trim()
  const [product] = await products.updateManyAndReturn({
    where: {
      id: req.params.id,
      quantity: { gte: Math.max(-change, 0), lte: maxInt - Math.max(change, 0) },
    },
    data: {
      quantity: { increment: change },
      lastUpdatedBy: req.user.id,
      ...(cleanNote ? { lastAdjustmentNote: cleanNote } : {}),
    },
  })

  if (!product) {
    const existing = await products.findFirst({ where: { id: req.params.id } })
    if (!existing) return sendNotFound(res)
    return res.status(400).json({ error: change < 0 ? 'Stock cannot go below 0' : 'Quantity is too large' })
  }

  const defaultThreshold = await getDefaultThreshold(organizationId)
  res.json({ product: { ...product, isLowStock: isLowStock(product, defaultThreshold) } })
})

router.delete('/:id', async (req, res) => {
  try {
    await productsFor(req.user.organizationId).delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return sendNotFound(res)
    throw err
  }
})

export default router
