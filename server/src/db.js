import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const url = new URL(process.env.DATABASE_URL)

for (const key of ['connect_timeout', 'pool_timeout']) {
  if (!url.searchParams.has(key)) url.searchParams.set(key, '15')
}

export const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })
