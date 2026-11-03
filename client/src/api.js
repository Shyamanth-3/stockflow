let unauthorizedHandler = null

export function onUnauthorized(handler) {
  unauthorizedHandler = handler
  return () => {
    unauthorizedHandler = null
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.()

    const error = new Error(data.error || 'Something went wrong')
    error.status = res.status
    throw error
  }

  return data
}
