import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { casesApi, dashboardApi } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatAction, formatCause, formatINR, formatPct } from '../utils/format'
import {
  filterByStatus,
  sortByStatus,
  type StatusSortMode,
} from '../utils/statusSort'

export function DashboardPage() {
  const [p1Sort, setP1Sort] = useState<StatusSortMode>('severity')
  const [p1Status, setP1Status] = useState<string | undefined>()
  const [closedSort, setClosedSort] = useState<StatusSortMode>('none')
  const [closedStatus, setClosedStatus] = useState<string | undefined>()

  const summary = useAsync(() => dashboardApi.summary(), [])
  const recovery = useAsync(() => dashboardApi.recovery(), [])
  const pipeline = useAsync(() => dashboardApi.pipeline(), [])
  const p1 = useAsync(() => casesApi.queue('p1', 8, 0), [])
  const recoveredCases = useAsync(() => casesApi.list({ limit: 200 }), [])

  const p1Rows = useMemo(() => {
    const items = p1.data?.items || []
    return sortByStatus(
      filterByStatus(items, (c) => c.current_state, p1Status),
      (c) => c.current_state,
      p1Sort,
    )
  }, [p1.data, p1Status, p1Sort])

  const recoveryRows = useMemo(() => {
    const items = (recoveredCases.data?.items || []).filter(
      (c) => (c.amount_recovered || 0) > 0,
    )
    const filtered = filterByStatus(items, (c) => c.current_state, closedStatus)
    return sortByStatus(filtered, (c) => c.current_state, closedSort).slice(0, 8)
  }, [recoveredCases.data, closedStatus, closedSort])

  if (summary.loading || recovery.loading) return <Loading label="Dashboard" />
  if (summary.error) return <ErrorState message={summary.error} />
  if (!summary.data || !recovery.data) return <ErrorState message="No dashboard data" />

  const s = summary.data
  const r = recovery.data
  const states = pipeline.data?.state_distribution || {}

  const stages = [
    { label: 'Detect', value: s.pipeline_cases },
    { label: 'Diagnose', value: s.pipeline_cases },
    { label: 'Decide', value: s.pipeline_cases },
    { label: 'Validate', value: s.successful_executions },
    { label: 'Execute', value: s.successful_executions },
    { label: 'Monitor', value: s.pipeline_cases },
  ]

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Recover revenue intelligently — money at risk, attention queue, and outcomes.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Revenue at Risk"
          value={formatINR(s.revenue_at_risk_universe)}
          sub={`Universe · ${s.universe_cases} open AR · remaining at risk`}
        />
        <MetricCard
          label="Recovered"
          value={formatINR(s.amount_recovered)}
          sub={`Pipeline remaining ${formatINR(s.revenue_at_risk_pipeline)}`}
        />
        <MetricCard
          label="Recovery Rate"
          value={formatPct(s.recovery_rate)}
          sub="Of pipeline revenue at risk"
        />
        <MetricCard
          label="Active Cases"
          value={String(s.pipeline_cases)}
          sub={`${s.active_cases} still open in loop`}
        />
        <MetricCard
          label="Human Review"
          value={String(s.human_escalations)}
          sub="Gated — not failed automation"
        />
        <MetricCard
          label="Auto Actions"
          value={String(s.successful_executions)}
          sub="Successful Day-7 executions"
        />
      </div>

      <Section
        title="What's next?"
        right={
          <Link to="/forecast" className="row-link">
            Open Forecast →
          </Link>
        }
      >
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          See expected 7/14/30-day recovery, action what-ifs, portfolio simulation, and
          risk heatmap — forecasts and counterfactuals, not guarantees.
        </p>
      </Section>

      <Section title="Recovery Pipeline">
        <div className="pipeline">
          {stages.map((st) => (
            <div key={st.label} className="pipeline-step">
              <strong>{st.value}</strong>
              <span>{st.label}</span>
            </div>
          ))}
        </div>
        {Object.keys(states).length > 0 && (
          <p style={{ marginTop: '0.85rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Current states:{' '}
            {Object.entries(states)
              .map(([k, v]) => `${k} ${v}`)
              .join(' · ')}
          </p>
        )}
      </Section>

      <div className="grid-2">
        <Section
          title="Priority Receivables"
          right={
            <Link to="/cases?priority=P1" className="row-link">
              View all →
            </Link>
          }
        >
          <div className="filters">
            <StatusSortControls
              sortMode={p1Sort}
              onSortModeChange={setP1Sort}
              statusFilter={p1Status || ''}
              onStatusFilterChange={setP1Status}
              statusOptions={(p1.data?.items || []).map((c) => c.current_state)}
            />
          </div>
          {p1.loading && <Loading />}
          {p1.error && <ErrorState message={p1.error} />}
          {p1.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Amount</th>
                    <th>Cause</th>
                    <th>Action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p1Rows.map((c) => (
                    <tr key={c.case_id}>
                      <td>
                        <Link className="row-link" to={`/cases/${c.case_id}`}>
                          {c.customer_name || c.case_id}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {c.case_id}
                        </div>
                      </td>
                      <td className="num">{formatINR(c.outstanding_amount)}</td>
                      <td>{formatCause(c.root_cause)}</td>
                      <td>{formatAction(c.recommended_action || c.authorized_action)}</td>
                      <td>
                        <StatusBadge status={c.current_state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Recent Recoveries"
          right={
            <Link to="/monitoring" className="row-link">
              Monitoring →
            </Link>
          }
        >
          <div className="filters">
            <StatusSortControls
              sortMode={closedSort}
              onSortModeChange={setClosedSort}
              statusFilter={closedStatus || ''}
              onStatusFilterChange={setClosedStatus}
              statusOptions={(recoveredCases.data?.items || [])
                .filter((c) => (c.amount_recovered || 0) > 0)
                .map((c) => c.current_state)}
            />
          </div>
          {recoveredCases.loading && <Loading />}
          {recoveredCases.data && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Customer</th>
                    <th className="num">Recovered</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recoveryRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--muted)' }}>
                        No recoveries yet — execute an approved case to see results here.
                      </td>
                    </tr>
                  ) : (
                    recoveryRows.map((c) => (
                      <tr key={c.case_id}>
                        <td>
                          <Link className="row-link" to={`/cases/${c.case_id}`}>
                            {c.case_id}
                          </Link>
                        </td>
                        <td>{c.customer_name || '—'}</td>
                        <td className="num">{formatINR(c.amount_recovered)}</td>
                        <td>
                          <StatusBadge status={c.current_state} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {r.full_recovery_rate != null && (
            <p className="empty-hint">
              Full recovery rate {formatPct(r.full_recovery_rate)} · partial{' '}
              {formatPct(r.partial_recovery_rate)} · no recovery{' '}
              {formatPct(r.no_recovery_rate)} (pipeline cohort)
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}
