import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { casesApi } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { ErrorState, Loading, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatAction, formatCause, formatINR } from '../utils/format'
import { nextWorkAction } from '../utils/lifecycle'
import { sortByStatus, type StatusSortMode } from '../utils/statusSort'

const PAGE_SIZE = 25

export function CasesPage() {
  const [params, setParams] = useSearchParams()
  const [qInput, setQInput] = useState(params.get('q') || '')
  const debouncedQ = useDebouncedValue(qInput.trim(), 300)
  const [sortMode, setSortMode] = useState<StatusSortMode>('severity')

  const filters = useMemo(
    () => ({
      priority: params.get('priority') || undefined,
      state: params.get('state') || undefined,
      root_cause: params.get('root_cause') || undefined,
      q: params.get('q') || undefined,
      offset: Number(params.get('offset') || 0),
      limit: PAGE_SIZE,
    }),
    [params],
  )

  const list = useAsync(
    () => casesApi.list(filters),
    [filters.priority, filters.state, filters.root_cause, filters.q, filters.offset],
  )

  const rows = useMemo(() => {
    const items = list.data?.items || []
    return sortByStatus(items, (c) => c.current_state, sortMode)
  }, [list.data, sortMode])

  useEffect(() => {
    const current = params.get('q') || ''
    if (current === debouncedQ) return
    const sp = new URLSearchParams(params)
    if (!debouncedQ) sp.delete('q')
    else sp.set('q', debouncedQ)
    sp.delete('offset')
    setParams(sp)
  }, [debouncedQ, params, setParams])

  function patch(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k)
      else sp.set(k, v)
    }
    if (!('offset' in next)) sp.delete('offset')
    setParams(sp)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Cases</h1>
          <p>What should I work next? Recovery queue prioritized by money at stake.</p>
        </div>
      </div>

      <Section title="Case Management">
        <div className="filters">
          <input
            className="search"
            placeholder="Search by risk ID or customer…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            aria-label="Search by risk ID or customer"
          />
          <select
            value={filters.priority || ''}
            onChange={(e) => patch({ priority: e.target.value || undefined })}
          >
            <option value="">All priorities</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
            <option value="P4">P4</option>
          </select>
          <StatusSortControls
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            statusFilter={filters.state || ''}
            onStatusFilterChange={(state) => patch({ state })}
          />
          <select
            value={filters.root_cause || ''}
            onChange={(e) => patch({ root_cause: e.target.value || undefined })}
          >
            <option value="">All root causes</option>
            <option value="BILLING_MISMATCH">BILLING_MISMATCH</option>
            <option value="PO_MISSING">PO_MISSING</option>
            <option value="ADMIN_BLOCKER">ADMIN_BLOCKER</option>
            <option value="CASH_FLOW_DELAY">CASH_FLOW_DELAY</option>
            <option value="SLOW_PAYER">SLOW_PAYER</option>
            <option value="DISPUTE">DISPUTE</option>
            <option value="PROMISE_BREACH">PROMISE_BREACH</option>
          </select>
        </div>

        {list.loading && <Loading />}
        {list.error && <ErrorState message={list.error} />}
        {list.data && (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Customer</th>
                    <th>Invoice</th>
                    <th className="num">Outstanding</th>
                    <th>Priority</th>
                    <th>Root cause</th>
                    <th>AI recommends</th>
                    <th>Next action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const next = nextWorkAction(c)
                    return (
                    <tr key={c.case_id}>
                      <td>
                        <Link className="row-link" to={`/cases/${c.case_id}`}>
                          {c.case_id}
                        </Link>
                      </td>
                      <td>{c.customer_name || c.customer_id || '—'}</td>
                      <td>{c.invoice_id || '—'}</td>
                      <td className="num">{formatINR(c.outstanding_amount)}</td>
                      <td>
                        {c.priority_level ? (
                          <StatusBadge status={c.priority_level} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{formatCause(c.root_cause)}</td>
                      <td>{formatAction(c.recommended_action || c.authorized_action)}</td>
                      <td>
                        <span className={`next-action kind-${next.kind}`}>{next.label}</span>
                      </td>
                      <td>
                        <StatusBadge status={c.current_state} />
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>
                Showing {list.data.offset + 1}–
                {list.data.offset + list.data.items.length} of {list.data.total}
              </span>
              <div className="pager-actions">
                <button
                  type="button"
                  disabled={list.data.offset <= 0}
                  onClick={() =>
                    patch({ offset: String(Math.max(0, list.data!.offset - PAGE_SIZE)) })
                  }
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!list.data.has_more}
                  onClick={() =>
                    patch({ offset: String(list.data!.offset + PAGE_SIZE) })
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Section>
    </div>
  )
}
