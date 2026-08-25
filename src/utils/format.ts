export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2)}L`
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatINRExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const n = value <= 1 ? value * 100 : value
  return `${n.toFixed(digits)}%`
}

export function formatAction(action: string | null | undefined): string {
  if (!action) return '—'
  return action.replace(/_/g, ' ')
}

export function formatCause(cause: string | null | undefined): string {
  if (!cause) return '—'
  return cause.replace(/_/g, ' ')
}

export function formatTs(ts: string | null | undefined): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}
