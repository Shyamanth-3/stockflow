import { prisma } from './db.js'

export function isLowStock(product, defaultThreshold) {
  return product.quantity <= (product.lowStockThreshold ?? defaultThreshold)
}

export function lowStockWhere(defaultThreshold) {
  return {
    OR: [
      { lowStockThreshold: null, quantity: { lte: defaultThreshold } },
      { quantity: { lte: prisma.product.fields.lowStockThreshold } },
    ],
  }
}
