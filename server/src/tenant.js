import { prisma } from './db.js'

export function productsFor(organizationId) {
  const scoped = (args = {}) => ({ ...args, where: { ...args.where, organizationId } })

  return {
    findMany: (args) => prisma.product.findMany(scoped(args)),
    findFirst: (args) => prisma.product.findFirst(scoped(args)),
    count: (args) => prisma.product.count(scoped(args)),
    updateManyAndReturn: (args) => prisma.product.updateManyAndReturn(scoped(args)),
    delete: (args) => prisma.product.delete(scoped(args)),
    create: (args) => prisma.product.create({ ...args, data: { ...args.data, organizationId } }),
  }
}
