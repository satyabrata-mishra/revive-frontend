import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { casesApi } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatAction, formatINR } from '../utils/format'
import {
  filterByStatus,
  sortByStatus,
  type StatusSortMode,
} from '../utils/statusSort'

export function MonitoringPage() {
  const [sortMode, setSortMode] = useState<StatusSortMode>('severity')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const all = useAsync(() => casesApi.list({ limit: 200, offset: 0 }), [])
  const closed = useAsync(() => casesApi.list({ state: 'CLOSED', limit: 50 }), [])
  const next = useAsync(
    () => casesApi.list({ state: 'NEXT_ACTION_PROPOSED', limit: 50 }),
    [],
  )
  const monitoring = useAsync(
    () => casesApi.list({ state: 'OUTCOME_MONITORING', limit: 50 }),
    [],
  )
  const escalated = useAsync(
    () => casesApi.list({ state: 'ESCALATED', limit: 50 }),
    [],
  )

  const { display, statusOptions } = useMemo(() => {
    const rows = [
      ...(closed.data?.items || []).slice(0, 8),
      ...(next.data?.items || []).slice(0, 6),
      ...(monitoring.data?.items || []).slice(0, 6),
      ...(escalated.data?.items || []).slice(0, 6),
    ]
    const seen = new Set<string>()
    const unique = rows.filter((r) => {
      if (seen.has(r.case_id)) return false
      seen.add(r.case_id)
      return true
    })
    const options = unique.map((c) => c.current_state).filter(Boolean)
    const filtered = filterByStatus(unique, (c) => c.current_state, statusFilter)
    return {
      display: sortByStatus(filtered, (c) => c.current_state, sortMode),
      statusOptions: options,
    }
  }, [closed.data, next.data, monitoring.data, escalated.data, statusFilter, sortMode])

  if (all.loading) return <Loading label="Recovery monitoring" />
  if (all.error) return <ErrorState message={all.error} />

  const items = all.data?.items || []
  const recovered = items.filter((c) => (c.amount_recovered || 0) > 0)
  const partial = items.filter(
    (c) =>
      (c.amount_recovered || 0) > 0 &&
      (c.outstanding_amount || 0) > 0.01 &&
      c.current_state !== 'CLOSED',
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Recovery Monitoring</h1>
          <p>
            Live operational statuses from unified case state — CLOSED, partial,
            monitoring, escalated.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard label="Closed" value={String(closed.data?.total ?? '—')} />
        <MetricCard
          label="Next action"
          value={String(next.data?.total ?? '—')}
        />
        <MetricCard
          label="Outcome monitoring"
          value={String(monitoring.data?.total ?? '—')}
        />
        <MetricCard
          label="Escalated"
          value={String(escalated.data?.total ?? '—')}
        />
        <MetricCard label="With recovery $" value={String(recovered.length)} />
        <MetricCard label="Partial (sample)" value={String(partial.length)} />
      </div>

      <Section title="Case Recovery Status">
        <div className="filters">
          <StatusSortControls
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            statusFilter={statusFilter || ''}
            onStatusFilterChange={setStatusFilter}
            statusOptions={statusOptions}
          />
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Case</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Recovered</th>
                <th>Outstanding</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {display.map((c) => (
                <tr key={c.case_id}>
                  <td>
                    <Link className="row-link" to={`/cases/${c.case_id}`}>
                      {c.case_id}
                    </Link>
                  </td>
                  <td>{c.customer_name || c.customer_id || '—'}</td>
                  <td>
                    <StatusBadge status={c.current_state} />
                  </td>
                  <td>{formatINR(c.amount_recovered)}</td>
                  <td>{formatINR(c.outstanding_amount)}</td>
                  <td>{formatAction(c.authorized_action || c.recommended_action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {display.length === 0 && (
          <p style={{ marginTop: '0.75rem', color: 'var(--muted)' }}>
            No cases match this status filter.
          </p>
        )}
        <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
          Status badges come from Day-12 unified case state via the API — not recomputed in React.
        </p>
      </Section>
    </div>
  )
}
