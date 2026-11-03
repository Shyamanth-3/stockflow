export function isLowStock(product, defaultThreshold) {
  return product.quantity <= (product.lowStockThreshold ?? defaultThreshold)
}
