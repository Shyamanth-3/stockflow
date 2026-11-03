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
