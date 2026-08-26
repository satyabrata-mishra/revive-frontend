import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewApi } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusBadge } from '../components/StatusBadge'
import { StatusSortControls } from '../components/StatusSortControls'
import { Badge, ErrorState, Loading, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatAction, formatCause, formatINR } from '../utils/format'
import {
  filterByStatus,
  sortByStatus,
  type StatusSortMode,
} from '../utils/statusSort'

function escalationCopy(item: {
  policy_decision?: string | null
  reason?: string | null
  authorized_action?: string | null
  requested_action?: string | null
}) {
  const decision = item.policy_decision || ''
  if (decision === 'HUMAN_REVIEW') {
    return {
      title: 'AUTOMATION HELD — HUMAN REVIEW',
      why:
        item.reason ||
        'Policy requires human judgment before any autonomous customer action.',
      humanAction: 'Review evidence, then Approve, Reject, or Escalate.',
    }
  }
  if (decision === 'BLOCKED') {
    return {
      title: 'AUTOMATION BLOCKED',
      why: item.reason || 'A hard policy rule blocked autonomous execution.',
      humanAction: 'Contact account manager or resolve the blocking condition.',
    }
  }
  if (
    ['HUMAN_REVIEW', 'ESCALATE_TO_HUMAN', 'ESCALATE_TO_ACCOUNT_MANAGER'].includes(
      item.authorized_action || item.requested_action || '',
    )
  ) {
    return {
      title: 'ROUTED TO HUMAN',
      why: item.reason || 'Recommended path is a human/conservative gate, not auto-recovery.',
      humanAction: 'Take over the customer conversation manually.',
    }
  }
  return {
    title: 'NEEDS ATTENTION',
    why: item.reason || 'Case is in the escalated queue.',
    humanAction: 'Inspect case detail before approving any action.',
  }
}

type PendingConfirm = {
  caseId: string
  kind: 'approve' | 'reject'
  label: string
}

export function ReviewPage() {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<StatusSortMode>('severity')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)

  const count = useAsync(() => reviewApi.count(), [])
  const queue = useAsync(
    () => reviewApi.queue({ status: 'PENDING', limit: 40 }),
    [flash],
  )

  const items = useMemo(() => {
    const list = queue.data?.items || []
    const q = search.trim().toLowerCase()
    const searched = q
      ? list.filter((i) => {
          const hay = [
            i.case_id,
            i.customer_id,
            i.customer_name,
            i.invoice_id,
            i.root_cause,
            i.authorized_action,
            i.requested_action,
            i.policy_decision,
            i.reason,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(q)
        })
      : list
    return sortByStatus(
      filterByStatus(searched, (i) => i.current_state, statusFilter),
      (i) => i.current_state,
      sortMode,
    )
  }, [queue.data, statusFilter, sortMode, search])

  function requestAct(
    caseId: string,
    kind: 'approve' | 'reject' | 'escalate',
    label: string,
  ) {
    if (kind === 'escalate') {
      void act(caseId, kind)
      return
    }
    setNote('')
    setConfirm({ caseId, kind, label })
  }

  async function act(caseId: string, kind: 'approve' | 'reject' | 'escalate') {
    setBusy(caseId + kind)
    setFlash(null)
    try {
      const res =
        kind === 'approve'
          ? await reviewApi.approve(caseId, { note: note.trim() || undefined })
          : kind === 'reject'
            ? await reviewApi.reject(caseId, note.trim() || undefined)
            : await reviewApi.escalate(caseId, note.trim() || undefined)
      setFlash(res.message)
      setNote('')
      setConfirm(null)
      count.reload()
      queue.reload()
    } catch (err) {
      setFlash(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Human Review</h1>
          <p>
            Autonomous when safe, human-controlled when necessary — approvals go through
            the backend only.
          </p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">In queue</div>
          <div className="metric-value">{count.data?.count ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Pending</div>
          <div className="metric-value">{count.data?.pending ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Approved</div>
          <div className="metric-value">{count.data?.approved ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Rejected</div>
          <div className="metric-value">{count.data?.rejected ?? '—'}</div>
        </div>
      </div>

      <Section title="Review Queue">
        <div className="filters">
          <input
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by risk ID, customer, invoice, cause…"
            aria-label="Search review queue"
          />
          <StatusSortControls
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            statusFilter={statusFilter || ''}
            onStatusFilterChange={setStatusFilter}
            statusOptions={(queue.data?.items || []).map((i) => i.current_state)}
          />
        </div>
        {flash && <p className="flash-msg">{flash}</p>}
        {queue.loading && <Loading />}
        {queue.error && <ErrorState message={queue.error} />}
        {queue.data?.items.length === 0 && (
          <p className="empty-hint">No pending review items.</p>
        )}
        {queue.data && queue.data.items.length > 0 && items.length === 0 && (
          <p className="empty-hint">
            No items match this {search.trim() ? 'search / ' : ''}status filter.
          </p>
        )}
        {items.map((item) => {
          const copy = escalationCopy(item)
          const open = expanded === item.case_id
          return (
            <div key={item.case_id} className="review-card">
              <div className="split-row">
                <div>
                  <Link className="row-link" to={`/cases/${item.case_id}`}>
                    {item.customer_name || item.case_id}
                  </Link>
                  <div className="case-meta" style={{ marginTop: '0.25rem' }}>
                    <span>{item.case_id}</span>
                    <span>·</span>
                    <span className="financial-figure">{formatINR(item.outstanding_amount)}</span>
                    <span>·</span>
                    <span>{formatCause(item.root_cause)}</span>
                  </div>
                </div>
                <div className="inline-actions" style={{ alignItems: 'start' }}>
                  <StatusBadge status={item.current_state} />
                  <Badge tone="warn">{item.review_status}</Badge>
                </div>
              </div>

              <div style={{ fontSize: '0.9rem' }}>
                <strong>{copy.title}</strong>
                <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Reason: {copy.why}
                </div>
                <div style={{ marginTop: '0.35rem' }}>
                  Recommended:{' '}
                  <strong>
                    {formatAction(item.authorized_action || item.requested_action)}
                  </strong>
                  {item.policy_decision ? ` · Policy ${item.policy_decision}` : ''}
                </div>
              </div>

              {open && (
                <div
                  className="decision-banner warn"
                  style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}
                >
                  Why escalated: {copy.why}
                  <br />
                  Recommended human action: {copy.humanAction}
                </div>
              )}

              <div className="review-actions">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : item.case_id)}
                >
                  {open ? 'Hide why' : 'Why escalated?'}
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!!busy}
                  onClick={() =>
                    requestAct(
                      item.case_id,
                      'approve',
                      item.customer_name || item.case_id,
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={!!busy}
                  onClick={() =>
                    requestAct(
                      item.case_id,
                      'reject',
                      item.customer_name || item.case_id,
                    )
                  }
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  aria-busy={busy === item.case_id + 'escalate'}
                  onClick={() => requestAct(item.case_id, 'escalate', '')}
                >
                  {busy === item.case_id + 'escalate' ? (
                    <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
                  ) : (
                    'Escalate'
                  )}
                </button>
                <Link to={`/cases/${item.case_id}`}>
                  <button type="button">Review Case</button>
                </Link>
              </div>
            </div>
          )
        })}
      </Section>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'reject' ? 'Confirm reject' : 'Confirm approve'}
        message={
          confirm?.kind === 'reject'
            ? `Reject recovery action for ${confirm.label} (${confirm.caseId})? This cannot be undone from this screen.`
            : `Approve and authorize recovery for ${confirm?.label} (${confirm?.caseId})?`
        }
        confirmLabel={confirm?.kind === 'reject' ? 'Reject' : 'Approve'}
        tone={confirm?.kind === 'reject' ? 'danger' : 'primary'}
        busy={!!confirm && busy === confirm.caseId + confirm.kind}
        note={note}
        notePlaceholder="Add an optional note for this decision…"
        onNoteChange={setNote}
        onCancel={() => {
          if (!busy) {
            setConfirm(null)
            setNote('')
          }
        }}
        onConfirm={() => {
          if (confirm) void act(confirm.caseId, confirm.kind)
        }}
      />
    </div>
  )
}
