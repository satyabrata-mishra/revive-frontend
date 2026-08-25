const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(status: number, body: { code?: string; message?: string; details?: unknown }) {
    super(body.message || `API error ${status}`)
    this.name = 'ApiError'
    this.code = body.code || 'UNKNOWN'
    this.status = status
    this.details = body.details
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  }
  return url.toString()
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
