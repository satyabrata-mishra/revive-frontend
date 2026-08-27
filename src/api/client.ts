const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

type ErrorBody = {
  success?: boolean
  error?: {
    code?: string
    message?: string
    case_id?: string
    retryable?: boolean
    details?: unknown
  }
  code?: string
  message?: string
  details?: unknown
}

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown
  caseId?: string | null
  retryable: boolean

  constructor(status: number, body: ErrorBody) {
    const nested = body?.error
    const message = nested?.message || body?.message || `API error ${status}`
    super(message)
    this.name = 'ApiError'
    this.code = nested?.code || body?.code || 'UNKNOWN'
    this.status = status
    this.details = nested?.details ?? body?.details
    this.caseId = nested?.case_id ?? null
    this.retryable = Boolean(nested?.retryable)
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

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export async function apiDelete<T = { status: string; message: string }>(
  path: string,
): Promise<T> {
  const res = await fetch(buildUrl(path), { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
