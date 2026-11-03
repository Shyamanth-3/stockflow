import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import { prisma } from '../src/db.js'
import { isLowStock } from '../src/lowStock.js'

const emailPrefix = `apptest-${Date.now()}`
const product = { name: 'Blue Pen', sku: 'PEN-1', quantity: 10, lowStockThreshold: 5 }
const protectedRoutes = [
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
let server

// helpers
function startServer(env = {}) {
  const child = spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  return new Promise((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`Test server exited with code ${code}`)))
    child.stdout.on('data', (chunk) => {
      const match = /port (\d+)/.exec(String(chunk))
      if (match) resolve({ child, baseUrl: `http://localhost:${match[1]}/api` })
    })
  })
}

function createClient(startingCookie = '', baseUrl = server.baseUrl) {
  let cookie = startingCookie

  async function request(method, path, body) {
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

  request.getCookie = () => cookie
  return request
}

async function signUp(name) {
  const request = createClient()
  const res = await request('POST', '/auth/signup', {
    email: `${emailPrefix}-${name}@example.com`,
    password: 'testpass123',
    organizationName: `${emailPrefix} ${name}`,
  })
  assert.equal(res.status, 201)
  return request
}

// setup
before(async () => {
  server = await startServer()
})

after(async () => {
  server.child.removeAllListeners('exit')
  server.child.kill()
  await prisma.organization.deleteMany({
    where: { nameKey: { startsWith: emailPrefix } },
  })
  await prisma.$disconnect()
})

// signup rules
describe('signup rules', () => {
  const details = (suffix, overrides) => ({
    email: `${emailPrefix}-${suffix}@example.com`,
    password: 'testpass123',
    organizationName: `${emailPrefix} ${suffix}`,
    ...overrides,
  })

  const weakPasswords = {
    'numbers only': '12345678',
    'letters only': 'abcdefgh',
    'too short': 'abc123',
    'over 72 characters': 'a1'.repeat(37),
    'over 72 bytes': `a1${'😀'.repeat(20)}`,
    'a NUL character': 'testpass\u0000123',
  }

  for (const [label, password] of Object.entries(weakPasswords)) {
    it(`rejects a password with ${label}`, async () => {
      const res = await createClient()('POST', '/auth/signup', details('weak', { password }))
      assert.equal(res.status, 400)
      assert.match(res.body.error, /letter and a number/)
    })
  }

  it('accepts letters and digits from other languages', async () => {
    const res = await createClient()('POST', '/auth/signup', details('telugu', { password: 'తెలుగుభాష౧౨౩' }))
    assert.equal(res.status, 201)
  })

  it('rejects a duplicate organization name in any capitalization or spacing', async () => {
    const first = details('dupe', { organizationName: `${emailPrefix} Dupe Store` })
    assert.equal((await createClient()('POST', '/auth/signup', first)).status, 201)

    for (const organizationName of [
      `${emailPrefix} Dupe Store`,
      `${emailPrefix} DUPE store`,
      `  ${emailPrefix}   Dupe   Store  `,
      `${emailPrefix} Dupe​ Store`,
    ]) {
      const res = await createClient()('POST', '/auth/signup', details('dupe2', { organizationName }))
      assert.equal(res.status, 409)
      assert.equal(res.body.error, 'An organization with this name already exists')
    }
  })

  it('rejects an organization name made of invisible characters', async () => {
    const res = await createClient()('POST', '/auth/signup', details('blank', { organizationName: '​​' }))
    assert.equal(res.status, 400)
  })

  it('rejects an organization name that is too long', async () => {
    const res = await createClient()('POST', '/auth/signup', details('long', { organizationName: 'x'.repeat(101) }))
    assert.equal(res.status, 400)
  })

  it('still reports a duplicate email as an email problem', async () => {
    const first = details('email')
    assert.equal((await createClient()('POST', '/auth/signup', first)).status, 201)

    const res = await createClient()('POST', '/auth/signup', details('email', { organizationName: `${emailPrefix} other` }))
    assert.equal(res.status, 409)
    assert.equal(res.body.error, 'An account with this email already exists')
  })

  it('rejects a slow-to-check email quickly', async () => {
    const email = `a@${'.'.repeat(99000)}@`
    const started = performance.now()
    const res = await createClient()('POST', '/auth/signup', details('slow', { email }))
    assert.equal(res.status, 400)
    assert.ok(performance.now() - started < 500)
  })

  it('handles text Postgres cannot store without a server error', async () => {
    const signup = await createClient()('POST', '/auth/signup', details('nul', { email: 'a\u0000b@example.com' }))
    assert.equal(signup.status, 400)

    const login = await createClient()('POST', '/auth/login', { email: 'a\u0000b@example.com', password: 'x' })
    assert.equal(login.status, 401)
  })
})

// sessions
describe('sessions', () => {
  it('rejects a valid token for an account that no longer exists', async () => {
    const token = jwt.sign({ userId: 'deleted-user', tokenVersion: 0 }, process.env.JWT_SECRET)
    const request = createClient(`token=${token}`)

    for (const [method, path] of protectedRoutes) {
      assert.equal((await request(method, path)).status, 401, `${method} ${path}`)
    }
  })

  it('rejects a copied token after logout', async () => {
    const request = await signUp('logout')
    const copiedCookie = request.getCookie()

    assert.equal((await createClient(copiedCookie)('GET', '/auth/me')).status, 200)
    assert.equal((await request('POST', '/auth/logout')).status, 200)
    assert.equal((await createClient(copiedCookie)('GET', '/auth/me')).status, 401)
  })

  it('allows logging back in after logout', async () => {
    const request = await signUp('relogin')
    await request('POST', '/auth/logout')

    const res = await request('POST', '/auth/login', {
      email: `${emailPrefix}-relogin@example.com`,
      password: 'testpass123',
    })
    assert.equal(res.status, 200)
    assert.equal((await request('GET', '/auth/me')).status, 200)
  })
})

// rate limits
describe('rate limits in production mode', () => {
  let production

  before(async () => {
    production = await startServer({ NODE_ENV: 'production' })
  })

  after(() => {
    production.child.removeAllListeners('exit')
    production.child.kill()
  })

  it('blocks repeated failed logins for one account but not others', async () => {
    const request = createClient('', production.baseUrl)
    const attempt = (email) => request('POST', '/auth/login', { email, password: 'wrongpass123' })

    for (let count = 0; count < 10; count++) {
      assert.equal((await attempt('limited@example.com')).status, 401)
    }

    const blocked = await attempt('limited@example.com')
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.error, 'Too many attempts. Please try again later.')
    assert.equal((await attempt('another@example.com')).status, 401)
  })

  it('blocks too many signups', async () => {
    const request = createClient('', production.baseUrl)
    const attempt = () => request('POST', '/auth/signup', { email: 'not-an-email' })

    for (let count = 0; count < 30; count++) {
      assert.equal((await attempt()).status, 400)
    }

    assert.equal((await attempt()).status, 429)
  })
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
  for (const [method, path] of protectedRoutes) {
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

// product input
describe('product input', () => {
  let request

  before(async () => {
    request = await signUp('input')
  })

  const invalid = {
    'a name over 200 characters': { name: 'x'.repeat(201) },
    'a SKU over 100 characters': { sku: 'x'.repeat(101) },
    'a description over 2000 characters': { description: 'x'.repeat(2001) },
    'a NUL character in the name': { name: 'a\u0000b' },
    'a lone surrogate in the name': { name: 'a\ud800b' },
    'a quantity of 1e3': { quantity: '1e3' },
    'a hex quantity': { quantity: '0x1F' },
    'a threshold of 1e3': { lowStockThreshold: '1e3' },
    'a price sent as a list': { sellingPrice: ['5'] },
  }

  for (const [label, overrides] of Object.entries(invalid)) {
    it(`rejects ${label}`, async () => {
      const res = await request('POST', '/products', { ...product, sku: 'BAD', ...overrides })
      assert.equal(res.status, 400)
    })
  }

  it('returns 404 for a product id Postgres cannot store', async () => {
    assert.equal((await request('GET', '/products/%00')).status, 404)
  })

  it('rejects a search Postgres cannot store', async () => {
    assert.equal((await request('GET', '/products?search=%00')).status, 400)
  })
})

// product edits
describe('product edits', () => {
  let request
  let saved

  before(async () => {
    request = await signUp('edits')
    saved = (await request('POST', '/products', product)).body.product
  })

  it('rejects an edit based on old data and keeps the newer stock', async () => {
    const path = `/products/${saved.id}`
    const opened = (await request('GET', path)).body.product

    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal((await request('POST', `${path}/adjust`, { change: -6 })).status, 200)

    const res = await request('PUT', path, { ...product, name: 'Renamed', updatedAt: opened.updatedAt })
    assert.equal(res.status, 409)
    assert.match(res.body.error, /changed after you opened it/)

    const current = (await request('GET', path)).body.product
    assert.equal(current.quantity, 4)
    assert.equal(current.name, product.name)
  })

  it('allows an edit based on the latest data', async () => {
    const path = `/products/${saved.id}`
    const opened = (await request('GET', path)).body.product
    const res = await request('PUT', path, { ...product, quantity: 4, name: 'Renamed', updatedAt: opened.updatedAt })
    assert.equal(res.status, 200)
    assert.equal(res.body.product.name, 'Renamed')
  })

  it('rejects an invalid updated time', async () => {
    const res = await request('PUT', `/products/${saved.id}`, { ...product, updatedAt: 'not-a-date' })
    assert.equal(res.status, 400)
  })

  it('returns a duplicate SKU error from an edit', async () => {
    await request('POST', '/products', { ...product, sku: 'TAKEN' })
    const res = await request('PUT', `/products/${saved.id}`, { ...product, sku: 'TAKEN' })
    assert.equal(res.status, 409)
    assert.match(res.body.error, /SKU/)
  })

  it('shows who last updated the product', async () => {
    const { body } = await request('GET', `/products/${saved.id}`)
    assert.equal(body.product.updatedByUser.email, `${emailPrefix}-edits@example.com`)
  })

  it('keeps the note when an adjustment has none, and clears it when quantity is edited', async () => {
    const path = `/products/${saved.id}`
    await request('POST', `${path}/adjust`, { change: -1, note: 'Damaged' })

    const kept = await request('POST', `${path}/adjust`, { change: 1 })
    assert.equal(kept.body.product.lastAdjustmentNote, 'Damaged')

    const sameQuantity = await request('PUT', path, { ...product, quantity: kept.body.product.quantity, name: 'Again' })
    assert.equal(sameQuantity.body.product.lastAdjustmentNote, 'Damaged')

    const newQuantity = await request('PUT', path, { ...product, quantity: 50 })
    assert.equal(newQuantity.body.product.lastAdjustmentNote, null)
  })
})

// product list and dashboard
describe('product list and dashboard', () => {
  let request

  before(async () => {
    request = await signUp('lists')
  })

  it('pages through products without gaps or repeats', async () => {
    const { organizationId } = (await request('POST', '/products', { ...product, sku: 'FIRST', quantity: 100 })).body.product
    await prisma.product.createMany({
      data: Array.from({ length: 54 }, (_, index) => ({
        organizationId,
        name: `Item ${index}`,
        sku: `ITEM-${index}`,
        quantity: 100,
      })),
    })

    const first = (await request('GET', '/products')).body
    const second = (await request('GET', '/products?page=2')).body
    const ids = new Set([...first.products, ...second.products].map((item) => item.id))

    assert.equal(first.total, 55)
    assert.equal(first.pageSize, 50)
    assert.equal(first.products.length, 50)
    assert.equal(second.page, 2)
    assert.equal(second.products.length, 5)
    assert.equal(ids.size, 55)
  })

  it('treats a bad page number as the first page', async () => {
    for (const page of ['0', '-1', 'abc', '1e3']) {
      assert.equal((await request('GET', `/products?page=${page}`)).body.page, 1)
    }
  })

  it('agrees with the product list about what is low stock', async () => {
    const other = await signUp('lowstock')
    const items = [
      ['AT', 5, 5],
      ['ABOVE', 6, 5],
      ['BELOW', 1, 5],
      ['DEFAULT-LOW', 5, ''],
      ['DEFAULT-OK', 6, ''],
      ['ZERO-STOCKED', 1, 0],
      ['ZERO-EMPTY', 0, 0],
    ]

    for (const [sku, quantity, lowStockThreshold] of items) {
      await other('POST', '/products', { name: sku, sku, quantity, lowStockThreshold })
    }

    const list = (await other('GET', '/products')).body.products
    const dashboard = (await other('GET', '/dashboard')).body
    const fromList = list.filter((item) => item.isLowStock).map((item) => item.sku).sort()
    const fromDashboard = dashboard.lowStockItems.map((item) => item.sku).sort()

    assert.deepEqual(fromDashboard, fromList)
    assert.deepEqual(fromDashboard, ['AT', 'BELOW', 'DEFAULT-LOW', 'ZERO-EMPTY'])
    assert.equal(dashboard.lowStockCount, 4)
    assert.equal(dashboard.totalProducts, 7)
    assert.equal(dashboard.totalUnits, 24)
  })

  it('adds up units beyond the database integer limit', async () => {
    const other = await signUp('bigtotal')
    await other('POST', '/products', { name: 'A', sku: 'A', quantity: 2147483647 })
    await other('POST', '/products', { name: 'B', sku: 'B', quantity: 2147483647 })

    const { status, body } = await other('GET', '/dashboard')
    assert.equal(status, 200)
    assert.equal(body.totalUnits, 4294967294)
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
