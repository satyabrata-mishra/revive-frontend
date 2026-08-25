import {
  COMMON_STATUS_FILTERS,
  STATUS_SORT_OPTIONS,
  type StatusSortMode,
} from '../utils/statusSort'

type Props = {
  sortMode: StatusSortMode
  onSortModeChange: (mode: StatusSortMode) => void
  /** When provided, shows a status filter select. */
  statusFilter?: string
  onStatusFilterChange?: (status: string | undefined) => void
  /** Extra status values to offer in the filter (merged with commons). */
  statusOptions?: string[]
  hideFilter?: boolean
}

export function StatusSortControls({
  sortMode,
  onSortModeChange,
  statusFilter = '',
  onStatusFilterChange,
  statusOptions,
  hideFilter = false,
}: Props) {
  const options = Array.from(
    new Set([...(statusOptions || []), ...COMMON_STATUS_FILTERS]),
  ).sort()

  return (
    <>
      {!hideFilter && onStatusFilterChange && (
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Sort by status"
        value={sortMode}
        onChange={(e) => onSortModeChange(e.target.value as StatusSortMode)}
      >
        {STATUS_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  )
}
