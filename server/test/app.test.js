import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import { prisma } from '../src/db.js'
import { isLowStock } from '../src/lowStock.js'

const port = 3099
const baseUrl = `http://localhost:${port}/api`
const emailPrefix = `apptest-${Date.now()}`
const product = { name: 'Blue Pen', sku: 'PEN-1', quantity: 10, lowStockThreshold: 5 }
let server

// helpers
function createClient() {
  let cookie = ''

  return async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    return { status: res.status, body: await res.json() }
  }
}

async function signUp(name) {
  const request = createClient()
  const res = await request('POST', '/auth/signup', {
    email: `${emailPrefix}-${name}@example.com`,
    password: 'testpass123',
    organizationName: `Test ${name}`,
  })
  assert.equal(res.status, 201)
  return request
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(`${baseUrl}/health`)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('Test server did not start')
}

// setup
before(async () => {
  server = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  })
  await waitForServer()
})

after(async () => {
  server.kill()
  await prisma.organization.deleteMany({
    where: { users: { some: { email: { startsWith: emailPrefix } } } },
  })
  await prisma.$disconnect()
})

// low stock rule
describe('isLowStock', () => {
  it('is low when quantity equals the threshold', () => {
    assert.equal(isLowStock({ quantity: 5, lowStockThreshold: 5 }, 1), true)
  })

  it('is not low above the threshold', () => {
    assert.equal(isLowStock({ quantity: 6, lowStockThreshold: 5 }, 100), false)
  })

  it('uses the default when the threshold is empty', () => {
    assert.equal(isLowStock({ quantity: 5, lowStockThreshold: null }, 5), true)
    assert.equal(isLowStock({ quantity: 6, lowStockThreshold: null }, 5), false)
  })

  it('treats a threshold of 0 as a real value', () => {
    assert.equal(isLowStock({ quantity: 1, lowStockThreshold: 0 }, 5), false)
    assert.equal(isLowStock({ quantity: 0, lowStockThreshold: 0 }, 5), true)
  })
})

// login required
describe('protected routes', () => {
  const routes = [
    ['GET', '/auth/me'],
    ['GET', '/products'],
    ['POST', '/products'],
    ['GET', '/products/any-id'],
    ['PUT', '/products/any-id'],
    ['DELETE', '/products/any-id'],
    ['POST', '/products/any-id/adjust'],
    ['GET', '/dashboard'],
    ['GET', '/settings'],
    ['PUT', '/settings'],
  ]

  for (const [method, path] of routes) {
    it(`${method} ${path} returns 401 without a login`, async () => {
      const res = await createClient()(method, path)
      assert.equal(res.status, 401)
    })
  }
})

// tenant isolation
describe('tenant isolation', () => {
  let orgA
  let orgB
  let productId

  before(async () => {
    orgA = await signUp('a')
    orgB = await signUp('b')
    const res = await orgA('POST', '/products', product)
    assert.equal(res.status, 201)
    productId = res.body.product.id
  })

  it('hides products from the list and search', async () => {
    assert.deepEqual((await orgB('GET', '/products')).body.products, [])
    assert.deepEqual((await orgB('GET', '/products?search=Blue')).body.products, [])
  })

  it('hides products from the dashboard', async () => {
    const { body } = await orgB('GET', '/dashboard')
    assert.equal(body.totalProducts, 0)
    assert.equal(body.totalUnits, 0)
  })

  it('blocks reading another organization product', async () => {
    assert.equal((await orgB('GET', `/products/${productId}`)).status, 404)
  })

  it('blocks updating another organization product', async () => {
    const res = await orgB('PUT', `/products/${productId}`, { ...product, name: 'Hacked' })
    assert.equal(res.status, 404)
  })

  it('blocks adjusting another organization product', async () => {
    const res = await orgB('POST', `/products/${productId}/adjust`, { change: 100 })
    assert.equal(res.status, 404)
  })

  it('blocks deleting another organization product', async () => {
    assert.equal((await orgB('DELETE', `/products/${productId}`)).status, 404)
  })

  it('leaves the product unchanged after those attempts', async () => {
    const { body } = await orgA('GET', `/products/${productId}`)
    assert.equal(body.product.name, product.name)
    assert.equal(body.product.quantity, product.quantity)
  })

  it('ignores an organization id sent in the request', async () => {
    const owner = await orgA('GET', `/products/${productId}`)
    const res = await orgB('POST', '/products', {
      ...product,
      sku: 'FORGED',
      organizationId: owner.body.product.organizationId,
    })
    assert.equal(res.status, 201)
    assert.notEqual(res.body.product.organizationId, owner.body.product.organizationId)
  })

  it('allows the same SKU in two organizations but not twice in one', async () => {
    assert.equal((await orgB('POST', '/products', product)).status, 201)
    assert.equal((await orgA('POST', '/products', product)).status, 409)
  })

  it('keeps settings separate', async () => {
    assert.equal((await orgB('PUT', '/settings', { defaultLowStockThreshold: 42 })).status, 200)
    assert.equal((await orgA('GET', '/settings')).body.defaultLowStockThreshold, 5)
  })
})

// stock adjust
describe('stock adjust', () => {
  it('never goes below 0 when adjustments arrive together', async () => {
    const request = await signUp('adjust')
    const { body } = await request('POST', '/products', product)
    const path = `/products/${body.product.id}/adjust`

    const results = await Promise.all(
      Array.from({ length: 5 }, () => request('POST', path, { change: -3 })),
    )

    assert.equal(results.filter((res) => res.status === 200).length, 3)
    assert.equal(results.filter((res) => res.status === 400).length, 2)

    const saved = await request('GET', `/products/${body.product.id}`)
    assert.equal(saved.body.product.quantity, 1)
  })
})
