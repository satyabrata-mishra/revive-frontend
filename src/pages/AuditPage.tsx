import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { auditApi, casesApi, policyApi } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { Badge, ErrorState, Loading, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatAction, formatCause, formatINR, formatINRExact, formatTs } from '../utils/format'
import {
  sortByStatus,
  type StatusSortMode,
} from '../utils/statusSort'

const PAGE_SIZE = 15

export function AuditPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const debouncedInput = useDebouncedValue(input.trim(), 350)
  const [sortMode, setSortMode] = useState<StatusSortMode>('severity')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [offset, setOffset] = useState(0)

  const cases = useAsync(
    () =>
      auditApi.listCases({
        q: debouncedInput || undefined,
        state: statusFilter,
        limit: PAGE_SIZE,
        offset,
      }),
    [debouncedInput, statusFilter, offset],
  )
  const timeline = useAsync(
    () => (selected ? auditApi.timeline(selected) : Promise.resolve(null)),
    [selected],
  )
  const summary = useAsync(
    () => (selected ? casesApi.summary(selected) : Promise.resolve(null)),
    [selected],
  )
  const policy = useAsync(
    () => (selected ? policyApi.get(selected) : Promise.resolve(null)),
    [selected],
  )

  const caseRows = useMemo(() => {
    const items = cases.data?.items || []
    return sortByStatus(items, (c) => c.current_state, sortMode)
  }, [cases.data, sortMode])

  // API returns newest-first; re-sort by timestamp only (stable) as a safety net.
  const timelineEvents = useMemo(() => {
    const list = [...(timeline.data?.events || [])]
    list.sort((a, b) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
    )
    return list
  }, [timeline.data])

  useEffect(() => {
    setOffset(0)
  }, [debouncedInput, statusFilter])

  useEffect(() => {
    const items = cases.data?.items
    if (!items?.length) return
    if (!selected) {
      setSelected(items[0].case_id)
    }
  }, [cases.data, selected])

  useEffect(() => {
    if (!debouncedInput || !cases.data?.items) return
    const exact = cases.data.items.find(
      (c) => c.case_id.toLowerCase() === debouncedInput.toLowerCase(),
    )
    if (exact) setSelected(exact.case_id)
  }, [debouncedInput, cases.data])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Audit Trail</h1>
          <p>Prove every decision and execution — not a black-box agent.</p>
        </div>
      </div>

      <Section title="Select Case">
        <div className="filters">
          <input
            className="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search all cases by risk ID, customer, invoice…"
            aria-label="Filter audit cases"
          />
          <StatusSortControls
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            statusFilter={statusFilter || ''}
            onStatusFilterChange={(value) => setStatusFilter(value || undefined)}
            statusOptions={Array.from(
              new Set((cases.data?.items || []).map((c) => c.current_state)),
            )}
          />
        </div>
        {cases.loading && <Loading />}
        {cases.error && <ErrorState message={cases.error} />}
        {cases.data && (
          <>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              {cases.data.total} cases total · live/closed cases with recent activity appear first
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {caseRows.map((c) => (
                    <tr
                      key={c.case_id}
                      style={
                        c.case_id === selected
                          ? { background: 'rgba(99, 102, 241, 0.08)' }
                          : undefined
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="row-link"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--accent)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setSelected(c.case_id)
                            setInput(c.case_id)
                          }}
                        >
                          {c.case_id}
                        </button>
                        {c.live_activity ? (
                          <span style={{ marginLeft: '0.35rem' }}>
                            <Badge tone="info">Live</Badge>
                          </span>
                        ) : null}
                      </td>
                      <td>{c.customer_name || '—'}</td>
                      <td>{formatINR(c.outstanding_amount)}</td>
                      <td>{formatAction(c.authorized_action || c.recommended_action)}</td>
                      <td>
                        <StatusBadge status={c.current_state} />
                      </td>
                      <td>{c.event_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>
                Showing {cases.data.offset + 1}–
                {cases.data.offset + cases.data.items.length} of {cases.data.total}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={cases.data.offset <= 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!cases.data.has_more}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        {cases.data && caseRows.length === 0 && (
          <p style={{ marginTop: '0.75rem', color: 'var(--muted)' }}>
            No cases match your filter.
          </p>
        )}
      </Section>

      <Section
        title={selected ? `Audit · ${selected}` : 'Audit · Select a case'}
        right={
          selected ? (
            <Link className="row-link" to={`/cases/${selected}`}>
              Open case →
            </Link>
          ) : null
        }
      >
        {summary.loading && <Loading />}
        {summary.data && (
          <>
            <div
              className="panel"
              style={{
                marginBottom: '1rem',
                padding: '1rem 1.15rem',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  Risk ID
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{summary.data.case_id}</div>
                <div className="case-meta" style={{ marginTop: '0.35rem' }}>
                  <span>{summary.data.customer_name || summary.data.customer_id || '—'}</span>
                  <span>·</span>
                  <span>{summary.data.invoice_id || '—'}</span>
                  {summary.data.customer_id ? (
                    <>
                      <span>·</span>
                      <span>{summary.data.customer_id}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {summary.data.priority_level ? (
                  <StatusBadge status={summary.data.priority_level} />
                ) : null}
                <StatusBadge status={summary.data.current_state} />
                <StatusBadge status={summary.data.system_status} />
              </div>
            </div>

            <dl className="kv" style={{ marginBottom: '1rem' }}>
              <dt>Root cause</dt>
              <dd>{formatCause(summary.data.root_cause)}</dd>
              <dt>Outstanding</dt>
              <dd>{formatINRExact(summary.data.outstanding_amount)}</dd>
              <dt>Recovered</dt>
              <dd>{formatINRExact(summary.data.amount_recovered)}</dd>
              <dt>Invoice status</dt>
              <dd>{summary.data.invoice_status || '—'}</dd>
              <dt>Authorized action</dt>
              <dd>
                {formatAction(
                  summary.data.authorized_action || summary.data.recommended_action,
                )}
              </dd>
              <dt>Policy decision</dt>
              <dd>
                {policy.data?.decision || '—'}
                {policy.data?.policy_version ? ` · ${policy.data.policy_version}` : ''}
              </dd>
              <dt>Customer aware</dt>
              <dd>
                {summary.data.customer_aware == null
                  ? '—'
                  : summary.data.customer_aware
                    ? 'Yes'
                    : 'No'}
              </dd>
            </dl>
          </>
        )}

        {timeline.loading && <Loading />}
        {timeline.error && <ErrorState message={timeline.error} />}
        {timelineEvents.length ? (
          <div className="timeline-scroll">
            <ul className="timeline">
              {timelineEvents.map((e, i) => (
                <li key={`${e.event}-${i}`}>
                  <span className="ts">{formatTs(e.timestamp)}</span>
                  <span>
                    <strong>{e.event}</strong>
                    <span style={{ color: 'var(--muted)' }}> · actor REVIVE</span>
                    {e.detail != null && e.detail !== '' ? (
                      <span style={{ color: 'var(--muted)' }}>
                        {' '}
                        · {String(e.detail)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !timeline.loading &&
          selected && (
            <p style={{ color: 'var(--muted)' }}>No timeline events for this case.</p>
          )
        )}
      </Section>
    </div>
  )
}
