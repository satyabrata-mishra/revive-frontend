/** Operational urgency — higher index = more urgent when sorting severity-desc. */
const SEVERITY: Record<string, number> = {
  ABORTED: 100,
  FAILED: 95,
  BLOCKED: 90,
  ESCALATED: 85,
  HUMAN_REVIEW: 80,
  NEXT_ACTION_PROPOSED: 55,
  OUTCOME_MONITORING: 50,
  HOLD_FOR_PROMISE: 45,
  ACTIVE: 40,
  PARTIAL_RECOVERY: 30,
  APPROVED: 20,
  SUCCESS: 15,
  RECOVERED: 12,
  FULL_RECOVERY: 10,
  CLOSED: 5,
}

export type StatusSortMode = 'none' | 'severity' | 'asc' | 'desc'

export const STATUS_SORT_OPTIONS: { value: StatusSortMode; label: string }[] = [
  { value: 'none', label: 'Status order: default' },
  { value: 'severity', label: 'Status: urgent first' },
  { value: 'asc', label: 'Status: A → Z' },
  { value: 'desc', label: 'Status: Z → A' },
]

export const COMMON_STATUS_FILTERS = [
  'CLOSED',
  'ESCALATED',
  'NEXT_ACTION_PROPOSED',
  'OUTCOME_MONITORING',
  'HUMAN_REVIEW',
  'ACTIVE',
] as const

export function statusSeverity(status: string | null | undefined): number {
  if (!status) return 0
  return SEVERITY[status] ?? 25
}

export function compareStatus(
  a: string | null | undefined,
  b: string | null | undefined,
  mode: StatusSortMode,
): number {
  if (mode === 'none') return 0
  const sa = a || ''
  const sb = b || ''
  if (mode === 'asc') return sa.localeCompare(sb)
  if (mode === 'desc') return sb.localeCompare(sa)
  // severity: urgent first
  return statusSeverity(b) - statusSeverity(a) || sa.localeCompare(sb)
}

export function sortByStatus<T>(
  items: T[],
  getStatus: (item: T) => string | null | undefined,
  mode: StatusSortMode,
): T[] {
  if (mode === 'none' || items.length < 2) return items
  return [...items].sort((x, y) => compareStatus(getStatus(x), getStatus(y), mode))
}

export function filterByStatus<T>(
  items: T[],
  getStatus: (item: T) => string | null | undefined,
  status: string | undefined,
): T[] {
  if (!status) return items
  return items.filter((item) => getStatus(item) === status)
}
