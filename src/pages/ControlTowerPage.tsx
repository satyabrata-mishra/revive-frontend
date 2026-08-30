import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { casesApi, controlTowerApi } from '../api'
import type { PipelineStage, Severity } from '../api/controlTower'
import { CaseAssistLink } from '../components/CaseAssistLink'
import { Badge, ErrorState, Loading, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import {
  formatAction,
  formatCause,
  formatINR,
  formatPct,
  formatTs,
} from '../utils/format'

const PAGE_SIZE = 15

const STAGE_FILTER: Record<string, string[] | undefined> = {
  detect: ['DETECTED'],
  diagnose: ['DIAGNOSED'],
  decide: ['STRATEGY_READY'],
  validate: ['POLICY_VALIDATED', 'EXECUTION_PENDING'],
  execute: ['EXECUTED'],
  monitor: ['OUTCOME_MONITORING', 'NEXT_ACTION_PROPOSED'],
  recovered: ['CLOSED'],
  escalated: ['ESCALATED', 'ABORTED', 'FAILED'],
}

function statusTone(status: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (status === 'OPERATIONAL' || status === 'HEALTHY') return 'ok'
  if (status === 'ATTENTION_REQUIRED' || status === 'DEGRADED') return 'warn'
  if (status === 'OFFLINE' || status === 'DOWN') return 'bad'
  return 'info'
}

function severityTone(sev: Severity): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (sev === 'CRITICAL') return 'bad'
  if (sev === 'HIGH') return 'warn'
  if (sev === 'MEDIUM') return 'info'
  return 'neutral'
}

function clock(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ts
  }
}

export function ControlTowerPage() {
  const [params, setParams] = useSearchParams()
  const stageFilter = params.get('stage') || ''
  const qParam = params.get('q') || ''
  const offset = Math.max(0, Number(params.get('offset') || 0) || 0)
  const [qInput, setQInput] = useState(qParam)
  const debouncedQ = useDebouncedValue(qInput.trim(), 300)
  const [tick, setTick] = useState(0)

  const overview = useAsync(() => controlTowerApi.overview(), [tick])
  const pipeline = useAsync(() => controlTowerApi.pipeline(), [tick])
  const activity = useAsync(() => controlTowerApi.activity(36), [tick])
  const attention = useAsync(() => controlTowerApi.attention(24), [tick])
  const performance = useAsync(() => controlTowerApi.performance(), [tick])
  const health = useAsync(() => controlTowerApi.systemHealth(), [tick])

  useEffect(() => {
    setQInput(qParam)
  }, [qParam])

  useEffect(() => {
    if (debouncedQ === qParam) return
    const next = new URLSearchParams(params)
    if (debouncedQ) next.set('q', debouncedQ)
    else next.delete('q')
    next.delete('offset')
    setParams(next, { replace: true })
  }, [debouncedQ, qParam, params, setParams])

  const statesForStage = stageFilter ? STAGE_FILTER[stageFilter] : undefined
  const cases = useAsync(async () => {
    const q = qParam.trim() || undefined

    // Multi-state stages need client filter + local page slice
    if (statesForStage && statesForStage.length > 1) {
      const page = await casesApi.list({ q, limit: 500, offset: 0 })
      const filtered = page.items.filter((c) =>
        statesForStage.includes(c.current_state),
      )
      const items = filtered.slice(offset, offset + PAGE_SIZE)
      return {
        items,
        total: filtered.length,
        limit: PAGE_SIZE,
        offset,
        has_more: offset + PAGE_SIZE < filtered.length,
      }
    }

    if (statesForStage?.length === 1) {
      return casesApi.list({
        q,
        state: statesForStage[0],
        limit: PAGE_SIZE,
        offset,
      })
    }

    return casesApi.list({ q, limit: PAGE_SIZE, offset })
  }, [tick, stageFilter, qParam, offset])

  const kpis = overview.data?.kpis
  const loading =
    overview.loading || pipeline.loading || activity.loading || attention.loading

  const funnelMax = useMemo(() => {
    const steps = performance.data?.funnel || []
    return Math.max(1, ...steps.map((s) => s.count || 0))
  }, [performance.data])

  function setStage(id: string | null) {
    const next = new URLSearchParams(params)
    if (!id || id === stageFilter) next.delete('stage')
    else next.set('stage', id)
    next.delete('offset')
    setParams(next, { replace: true })
  }

  function setOffset(nextOffset: number) {
    const next = new URLSearchParams(params)
    if (nextOffset <= 0) next.delete('offset')
    else next.set('offset', String(nextOffset))
    setParams(next, { replace: true })
  }

  function clearSearch() {
    setQInput('')
    const next = new URLSearchParams(params)
    next.delete('q')
    next.delete('offset')
    setParams(next, { replace: true })
  }

  if (loading && !overview.data) return <Loading label="Control Tower" />
  if (overview.error) {
    return (
      <div className="ct-page">
        <ErrorState message={overview.error} />
        <p className="ct-error-hint">
          The recovery services may still be running, but this dashboard could not retrieve
          the latest operational state.
        </p>
        <button type="button" className="primary" onClick={() => setTick((t) => t + 1)}>
          Retry
        </button>
      </div>
    )
  }
  if (!overview.data || !kpis) return <ErrorState message="No Control Tower data" />

  const status = overview.data.system_status

  return (
    <div className="ct-page">
      <header className="ct-header">
        <div>
          <p className="ct-kicker">Revive · Operational command center</p>
          <h1>Autonomous Recovery Control Tower</h1>
          <p className="ct-lede">
            Real-time view of what Revive is doing, what happened next, and where humans
            must intervene.
          </p>
        </div>
        <div className="ct-header-meta">
          <Badge tone={statusTone(status)} title={overview.data.status_reason}>
            ● {status.replace(/_/g, ' ')}
          </Badge>
          <span className="ct-updated">Updated {clock(overview.data.generated_at)}</span>
          <button type="button" className="ghost" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </button>
        </div>
      </header>

      <section className="ct-kpi-grid" aria-label="Executive KPIs">
        <Kpi
          label="Revenue at Risk"
          value={formatINR(kpis.revenue_at_risk)}
          sub={`${kpis.universe_cases} open AR`}
          to="/cases"
        />
        <Kpi
          label="Amount Recovered"
          value={formatINR(kpis.amount_recovered)}
          sub="Through Revive"
          to="/monitoring"
        />
        <Kpi
          label="Active Recovery Cases"
          value={String(kpis.active_cases)}
          sub="In pipeline"
          onClick={() => setStage(null)}
        />
        <Kpi
          label="Recovery Rate"
          value={formatPct(kpis.recovery_rate)}
          sub="Gross · pipeline"
        />
        <Kpi
          label="Autonomous Executions"
          value={String(kpis.autonomous_executions)}
          sub="Without human intervention"
        />
        <Kpi
          label="Human Escalations"
          value={String(kpis.human_escalations)}
          sub="Gated — not failed automation"
          to="/review"
        />
        <Kpi
          label="Execution Success"
          value={`${kpis.execution_success} / ${kpis.execution_attempts || kpis.execution_success}`}
          sub={formatPct(kpis.execution_success_rate)}
        />
        <Kpi
          label="Policy Violations"
          value={String(kpis.policy_violations)}
          sub="Authorization blocks"
        />
      </section>

      <Section title="Recovery Pipeline">
        <p className="ct-section-note">
          Click a stage to filter the case explorer below.
        </p>
        <div className="ct-pipeline" role="list">
          {(pipeline.data?.stages || []).map((stage) => (
            <PipelineNode
              key={stage.id}
              stage={stage}
              active={stageFilter === stage.id}
              onSelect={() => setStage(stage.id)}
            />
          ))}
        </div>
      </Section>

      <div className="ct-split">
        <Section
          title="Autonomous Activity"
          right={
            <span className="ct-live-pill" title="Refresh to pull latest events">
              Live feed
            </span>
          }
        >
          {!activity.data?.items.length ? (
            <p className="ct-empty">No recent autonomous actions.</p>
          ) : (
            <ul className="ct-activity">
              {activity.data.items
                .filter((item, idx, arr) => {
                  const minute = (item.timestamp || '').slice(0, 16)
                  const key = `${item.case_id}|${item.action}|${minute}`
                  return (
                    arr.findIndex((x) => {
                      const m = (x.timestamp || '').slice(0, 16)
                      return `${x.case_id}|${x.action}|${m}` === key
                    }) === idx
                  )
                })
                .slice(0, 16)
                .map((item) => (
                <li key={item.id} className={`ct-activity-item tone-${item.tone}`}>
                  <div className="ct-activity-time">{formatTs(item.timestamp)}</div>
                  <div className="ct-activity-body">
                    <Link to={`/cases/${item.case_id}`} className="ct-case-link">
                      {item.case_id}
                    </Link>
                    <CaseAssistLink caseId={item.case_id} from="control-tower" dense />
                    {item.customer_name ? (
                      <span className="ct-muted"> · {item.customer_name}</span>
                    ) : null}
                    <div className="ct-activity-action">
                      {formatAction(item.action)}
                      {item.amount != null ? (
                        <span className="ct-muted"> · {formatINR(item.amount)}</span>
                      ) : null}
                    </div>
                    <div className="ct-activity-result">
                      {formatAction(item.result)}
                      {item.next_state ? (
                        <span className="ct-muted"> → {formatAction(item.next_state)}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Attention Required"
          right={
            <Link to="/review" className="row-link">
              Open Human Review →
            </Link>
          }
        >
          {!attention.data?.items.length ? (
            <p className="ct-empty">
              No cases require attention. Revive is operating autonomously.
            </p>
          ) : (
            <ul className="ct-attention">
              {attention.data.items.map((item) => (
                <li key={`${item.case_id}-${item.reason}`} className="ct-attention-item">
                  <div className="ct-attention-top">
                    <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                    <span className="ct-attention-amount">
                      {formatINR(item.outstanding_amount)}
                    </span>
                  </div>
                  <Link to={`/cases/${item.case_id}`} className="ct-case-link">
                    {item.case_id}
                  </Link>
                  {item.customer_name ? (
                    <div className="ct-muted">{item.customer_name}</div>
                  ) : null}
                  <p className="ct-attention-reason">{item.reason}</p>
                  {item.recommended_action ? (
                    <div className="ct-attention-action">
                      Recommended: {formatAction(item.recommended_action)}
                    </div>
                  ) : null}
                  <Link to={`/cases/${item.case_id}`} className="ct-attention-cta">
                    {item.cta} →
                  </Link>
                  <CaseAssistLink
                    caseId={item.case_id}
                    from="control-tower"
                    dense
                    className="ct-attention-assist"
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recovery Performance">
        {performance.loading && !performance.data ? (
          <Loading size="sm" label="Performance" />
        ) : performance.data ? (
          <div className="ct-perf">
            <div className="ct-perf-metrics">
              <div>
                <span className="metric-label">Full recovery</span>
                <strong>{formatPct(performance.data.full_recovery_rate)}</strong>
              </div>
              <div>
                <span className="metric-label">Partial recovery</span>
                <strong>{formatPct(performance.data.partial_recovery_rate)}</strong>
              </div>
              <div>
                <span className="metric-label">No recovery</span>
                <strong>{formatPct(performance.data.no_recovery_rate)}</strong>
              </div>
              <div>
                <span className="metric-label">Autonomous success</span>
                <strong>{formatPct(performance.data.autonomous_success_rate)}</strong>
              </div>
              <div>
                <span className="metric-label">Human escalation rate</span>
                <strong>{formatPct(performance.data.human_escalation_rate)}</strong>
              </div>
              <div>
                <span className="metric-label">Policy block rate</span>
                <strong>{formatPct(performance.data.policy_block_rate)}</strong>
              </div>
            </div>
            <div className="ct-funnel" aria-label="Recovery funnel">
              {performance.data.funnel.map((step) => {
                const n = step.count ?? 0
                const width =
                  step.amount != null
                    ? Math.min(
                        100,
                        Math.max(
                          18,
                          (100 * step.amount) /
                            Math.max(performance.data.revenue_at_risk || 1, step.amount),
                        ),
                      )
                    : Math.max(10, (100 * n) / funnelMax)
                return (
                  <div key={step.id} className="ct-funnel-row">
                    <span className="ct-funnel-label">{step.label}</span>
                    <div className="ct-funnel-bar-track">
                      <div className="ct-funnel-bar" style={{ width: `${width}%` }} />
                    </div>
                    <span className="ct-funnel-value">
                      {step.amount != null ? formatINR(step.amount) : n}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="ct-empty">Performance metrics unavailable.</p>
        )}
      </Section>

      <Section
        title="Case Explorer"
        right={
          stageFilter || qParam ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setQInput('')
                const next = new URLSearchParams(params)
                next.delete('stage')
                next.delete('q')
                next.delete('offset')
                setParams(next, { replace: true })
              }}
            >
              Clear filters
            </button>
          ) : null
        }
      >
        <div className="filters ct-explorer-filters">
          <input
            className="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by case ID, invoice, or customer…"
            aria-label="Search cases"
          />
          {qParam ? (
            <button type="button" className="ghost" onClick={clearSearch}>
              Clear search
            </button>
          ) : null}
          {stageFilter ? (
            <Badge tone="info">Stage: {stageFilter}</Badge>
          ) : null}
        </div>
        {cases.loading ? (
          <Loading size="sm" label="Cases" />
        ) : cases.error ? (
          <ErrorState message={cases.error} />
        ) : !cases.data?.items.length ? (
          <p className="ct-empty">No cases match this view.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>State</th>
                    <th>Root cause</th>
                    <th>Action</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.data.items.map((c) => (
                    <tr key={c.case_id}>
                      <td>
                        <Link to={`/cases/${c.case_id}`}>{c.case_id}</Link>
                      </td>
                      <td>{c.customer_name || c.customer_id || '—'}</td>
                      <td>{c.priority_level || '—'}</td>
                      <td>{formatAction(c.current_state)}</td>
                      <td>{formatCause(c.root_cause)}</td>
                      <td>
                        {formatAction(c.authorized_action || c.recommended_action)}
                      </td>
                      <td>{formatINR(c.outstanding_amount)}</td>
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
              <div className="pager-actions">
                <button
                  type="button"
                  disabled={cases.data.offset <= 0}
                  onClick={() => setOffset(Math.max(0, cases.data!.offset - PAGE_SIZE))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!cases.data.has_more}
                  onClick={() => setOffset(cases.data!.offset + PAGE_SIZE)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="System Health">
        {health.loading && !health.data ? (
          <Loading size="sm" label="Health" />
        ) : health.data ? (
          <div className="ct-health">
            <div className="ct-health-services">
              {health.data.services.map((svc) => (
                <div key={svc.id} className="ct-health-card">
                  <Badge tone={statusTone(svc.status)}>● {svc.status}</Badge>
                  <strong>{svc.label}</strong>
                  <span className="ct-muted">{svc.detail}</span>
                </div>
              ))}
            </div>
            <div className="ct-reliability">
              <h3>Reliability</h3>
              <dl className="kv">
                <dt>Duplicate prevention</dt>
                <dd>{health.data.reliability.duplicate_prevention || '—'}</dd>
                <dt>State conflicts</dt>
                <dd>{health.data.reliability.state_conflicts}</dd>
                <dt>Policy violations</dt>
                <dd>{health.data.reliability.policy_violations}</dd>
                <dt>Technical failures</dt>
                <dd>{health.data.reliability.technical_failures}</dd>
                <dt>Authorization compliance</dt>
                <dd>{health.data.reliability.authorization_compliance || '—'}</dd>
                <dt>Aborted executions</dt>
                <dd>{health.data.reliability.aborted_executions}</dd>
              </dl>
            </div>
          </div>
        ) : (
          <p className="ct-empty">System health unavailable.</p>
        )}
      </Section>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  to,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  to?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </>
  )
  if (to) {
    return (
      <Link to={to} className="metric-card ct-kpi-card">
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className="metric-card ct-kpi-card" onClick={onClick}>
        {inner}
      </button>
    )
  }
  return <div className="metric-card ct-kpi-card">{inner}</div>
}

function PipelineNode({
  stage,
  active,
  onSelect,
}: {
  stage: PipelineStage
  active: boolean
  onSelect: () => void
}) {
  const display =
    stage.id === 'recovered' || stage.id === 'escalated' || stage.id === 'monitor'
      ? stage.count || stage.cumulative_count
      : stage.cumulative_count || stage.count

  return (
    <button
      type="button"
      role="listitem"
      className={`ct-pipe-node${active ? ' is-active' : ''}`}
      onClick={onSelect}
      title={stage.states.join(', ')}
    >
      <span className="ct-pipe-label">{stage.label}</span>
      <span className="ct-pipe-count">{display}</span>
      <span className="ct-pipe-sub">{stage.count} in stage</span>
    </button>
  )
}
