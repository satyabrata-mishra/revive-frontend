import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { casesApi } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatINR } from '../utils/format'
import { nextWorkAction } from '../utils/lifecycle'
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
  const recoveredAmt = items.reduce((s, c) => s + (c.amount_recovered || 0), 0)
  const escalatedAmt = (escalated.data?.items || []).reduce(
    (s, c) => s + (c.outstanding_amount || 0),
    0,
  )
  const monitoringAmt = (monitoring.data?.items || []).reduce(
    (s, c) => s + (c.outstanding_amount || 0),
    0,
  )
  const nextAmt = (next.data?.items || []).reduce(
    (s, c) => s + (c.outstanding_amount || 0),
    0,
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Recovery Monitoring</h1>
          <p>What is happening to your money right now — actions, outcomes, and exceptions.</p>
        </div>
      </div>

      <Section title="Operations snapshot">
        <div className="metric-grid">
          <MetricCard
            label="Recovered (sample)"
            value={formatINR(recoveredAmt)}
            sub="Across loaded cases"
          />
          <MetricCard
            label="Awaiting human"
            value={formatINR(escalatedAmt)}
            sub={`${escalated.data?.total ?? '—'} escalated cases`}
          />
          <MetricCard
            label="Awaiting outcome"
            value={formatINR(monitoringAmt)}
            sub={`${monitoring.data?.total ?? '—'} in monitoring`}
          />
          <MetricCard
            label="Next action ready"
            value={formatINR(nextAmt)}
            sub={`${next.data?.total ?? '—'} cases`}
          />
        </div>

        <div className="monitor-pipeline" aria-label="Recovery pipeline">
          <div className="monitor-pipe-step">
            <strong>{escalated.data?.total ?? '—'}</strong>
            <span>Escalated</span>
            <em>{formatINR(escalatedAmt)}</em>
          </div>
          <span className="monitor-pipe-arrow" aria-hidden="true">
            →
          </span>
          <div className="monitor-pipe-step">
            <strong>{next.data?.total ?? '—'}</strong>
            <span>Next action</span>
            <em>{formatINR(nextAmt)}</em>
          </div>
          <span className="monitor-pipe-arrow" aria-hidden="true">
            →
          </span>
          <div className="monitor-pipe-step">
            <strong>{monitoring.data?.total ?? '—'}</strong>
            <span>Outcome monitoring</span>
            <em>{formatINR(monitoringAmt)}</em>
          </div>
          <span className="monitor-pipe-arrow" aria-hidden="true">
            →
          </span>
          <div className="monitor-pipe-step">
            <strong>{closed.data?.total ?? '—'}</strong>
            <span>Closed</span>
            <em>Recovered loop</em>
          </div>
        </div>
      </Section>

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
                <th className="num">Recovered</th>
                <th className="num">Outstanding</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {display.map((c) => {
                const next = nextWorkAction(c)
                return (
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
                    <td className="num">{formatINR(c.amount_recovered)}</td>
                    <td className="num">{formatINR(c.outstanding_amount)}</td>
                    <td>
                      <span className={`next-action kind-${next.kind}`}>{next.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {display.length === 0 && (
          <p className="empty-hint">No cases match this status filter.</p>
        )}
      </Section>
    </div>
  )
}
