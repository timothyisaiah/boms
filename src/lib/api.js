export class ApiError extends Error {
  constructor(message, status = 0, kind = 'network') {
    super(message)
    this.status = status
    this.kind = kind
  }
}
export async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      signal: options.signal ?? AbortSignal.timeout(30000)
    })
  } catch {
    throw new ApiError(
      options.headers?.['Idempotency-Key']
        ? 'Connection interrupted. Your submission is saved for retry; its outcome has not been confirmed.'
        : 'Connection interrupted. Please reconnect and try again.'
    )
  }
  if (response.status === 204) return null
  let body
  try {
    body = await response.json()
  } catch {
    throw new ApiError(
      'The service returned an incomplete response. Retry to confirm the result.'
    )
  }
  if (!response.ok)
    throw new ApiError(
      body.error ?? 'Request failed.',
      response.status,
      body.kind ?? (response.status >= 500 ? 'network' : 'validation')
    )
  return body
}
