import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { warRoomApi, type PlanStep, type WarRoomDetail } from '../api'
import { Badge, ErrorState, Loading } from '../components/ui'
import { StatusBadge } from '../components/StatusBadge'
import { useAsync } from '../hooks/useAsync'
import { formatAction, formatINR, formatINRExact, formatPct, formatTs } from '../utils/format'
import type { HealthTrend, WarRoomSeverity } from '../api/warRoom'

function sevTone(sev: WarRoomSeverity): 'bad' | 'warn' | 'info' | 'neutral' {
  if (sev === 'SEV-1') return 'bad'
  if (sev === 'SEV-2') return 'warn'
  if (sev === 'SEV-3') return 'info'
  return 'neutral'
}

function healthTone(t: HealthTrend): 'bad' | 'warn' | 'ok' | 'info' {
  if (t === 'CRITICAL' || t === 'HIGH') return 'bad'
  if (t === 'STABLE') return 'warn'
  if (t === 'IMPROVING' || t === 'RESOLVED') return 'ok'
  return 'info'
}

function stepTone(status: PlanStep['status']): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (status === 'APPROVED' || status === 'DONE') return 'ok'
  if (status === 'REJECTED' || status === 'BLOCKED') return 'bad'
  if (status === 'IN_PROGRESS') return 'info'
  return 'warn'
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function WarRoomIncidentPage() {
  const { incidentId = '' } = useParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [local, setLocal] = useState<WarRoomDetail | null>(null)

  const detail = useAsync(() => warRoomApi.get(incidentId), [incidentId])

  const d = local || detail.data

  const run = useCallback(
    async (key: string, fn: () => Promise<WarRoomDetail>, okMsg: string) => {
      setBusy(key)
      setFlash(null)
      try {
        const next = await fn()
        setLocal(next)
        setFlash(okMsg)
      } catch (e) {
        setFlash(e instanceof Error ? e.message : 'Action failed')
      } finally {
        setBusy(null)
      }
    },
    [],
  )

  if (detail.loading && !d) return <Loading label="Opening War Room…" />
  if (detail.error && !d) return <ErrorState message={detail.error} />
  if (!d) return <ErrorState message="Incident not found" />

  const closed = d.status === 'RESOLVED' || d.status === 'CLOSED'

  return (
    <div className={`wr-incident sev-${d.severity.toLowerCase()}`}>
      <div className="wr-incident-bar">
        <Link to="/war-room" className="wr-back">
          ← War Rooms
        </Link>
        <div className="wr-incident-identity">
          <p className="wr-kicker">Recovery War Room</p>
          <div className="wr-title-row">
            <h1>{d.title}</h1>
            <Badge tone={sevTone(d.severity)}>{d.severity}</Badge>
            <Badge tone={healthTone(d.health.trend)}>{d.status.replace(/_/g, ' ')}</Badge>
          </div>
          <div className="wr-meta">
            <span>{d.incident_id}</span>
            <span>·</span>
            <span>Owner {d.owner}</span>
            <span>·</span>
            <span>Opened {formatTs(d.created_at)}</span>
            <span>·</span>
            <span>Duration {formatDuration(d.duration_minutes)}</span>
            <span>·</span>
            <span>Updated {formatTs(d.updated_at)}</span>
          </div>
        </div>
        <div className="wr-incident-actions">
          {!closed && (
            <>
              <button
                type="button"
                className="ghost"
                disabled={!!busy}
                onClick={() =>
                  void run('advance', () => warRoomApi.advanceDemo(d.incident_id), 'Recovery progress updated')
                }
              >
                {busy === 'advance' ? 'Updating…' : 'Simulate progress'}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busy}
                onClick={() =>
                  void run(
                    'resolve',
                    () => warRoomApi.resolve(d.incident_id, 'Operator closed War Room'),
                    'Incident resolved — postmortem ready',
                  )
                }
              >
                {busy === 'resolve' ? 'Closing…' : 'Resolve incident'}
              </button>
            </>
          )}
        </div>
      </div>

      {flash && <div className="wr-flash">{flash}</div>}

      {/* 1–2: What happened + money */}
      <section className="wr-impact" aria-label="Financial impact">
        <div className="wr-impact-main">
          <span className="wr-impact-label">Revenue at risk</span>
          <strong className="wr-impact-hero">{formatINRExact(d.impact.revenue_at_risk)}</strong>
          {d.impact.incremental_vs_baseline != null && d.impact.incremental_vs_baseline !== 0 ? (
            <span className="wr-impact-delta">
              {d.impact.incremental_vs_baseline > 0 ? '↓' : '↑'}{' '}
              {formatINR(Math.abs(d.impact.incremental_vs_baseline))} vs baseline
            </span>
          ) : null}
        </div>
        <div className="wr-impact-grid">
          <div>
            <span>Recovered</span>
            <strong>{formatINRExact(d.impact.amount_recovered)}</strong>
          </div>
          <div>
            <span>Recovery rate</span>
            <strong>{formatPct(d.impact.recovery_rate)}</strong>
          </div>
          <div>
            <span>Cases</span>
            <strong>{d.impact.affected_case_count}</strong>
          </div>
          <div>
            <span>Customers</span>
            <strong>{d.impact.affected_customer_count}</strong>
          </div>
          <div>
            <span>P1</span>
            <strong>{d.impact.p1_count}</strong>
          </div>
          <div>
            <span>Escalations</span>
            <strong>{d.impact.human_escalations}</strong>
          </div>
          <div>
            <span>Expected recovery</span>
            <strong>{formatINRExact(d.impact.expected_recovery)}</strong>
          </div>
          <div>
            <span>Health</span>
            <strong>
              {d.health.score} · {d.health.trend}
            </strong>
          </div>
        </div>
      </section>

      {/* Situation summary */}
      <section className="wr-situation">
        <h2>Situation</h2>
        <p>{d.situation.situation}</p>
        <p className="wr-muted">{d.situation.current_status}</p>
        <p>
          <strong>Blocker:</strong> {d.situation.primary_blocker}
        </p>
        <p>
          <strong>Recommendation:</strong> {d.situation.recommendation}
        </p>
      </section>

      <div className="wr-split">
        {/* 3: Why */}
        <section className="wr-panel">
          <h2>AI incident diagnosis</h2>
          <div className="wr-diag-head">
            <div>
              <span className="wr-label">Primary cause</span>
              <strong>{formatAction(d.diagnosis.primary_cause)}</strong>
            </div>
            <div>
              <span className="wr-label">Confidence</span>
              <strong>{formatPct(d.diagnosis.confidence)}</strong>
            </div>
          </div>
          <p className="wr-muted">{d.diagnosis.detection_signal}</p>
          <p className="wr-muted">Segment · {d.diagnosis.affected_segment}</p>
          <h3>Evidence</h3>
          <ul className="wr-evidence">
            {d.diagnosis.evidence.map((e) => (
              <li key={e.text}>
                {e.text}
                {e.source ? <span className="wr-muted"> · {e.source}</span> : null}
              </li>
            ))}
          </ul>
          <h3>Cause mix</h3>
          <ul className="wr-cause-mix">
            {d.diagnosis.cause_mix.map((m) => (
              <li key={m.root_cause}>
                <span>{formatAction(m.root_cause)}</span>
                <span>
                  {Math.round(m.share * 100)}% · {m.count} · {formatINR(m.outstanding)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Timeline */}
        <section className="wr-panel">
          <h2>Timeline</h2>
          <ol className="wr-timeline">
            {[...d.timeline].reverse().map((evt) => (
              <li key={evt.event_id}>
                <time>{formatTs(evt.timestamp)}</time>
                <strong>{evt.event_type.replace(/_/g, ' ')}</strong>
                <span>
                  {evt.description}
                  <span className="wr-muted"> · {evt.actor}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 4: What should we do */}
      <section className="wr-panel wr-plan">
        <div className="wr-plan-head">
          <div>
            <h2>AI response plan</h2>
            <p className="wr-muted">{d.objective}</p>
          </div>
          <div className="wr-next-move">
            <span className="wr-label">Next best move</span>
            <strong>{d.next_best_move.title}</strong>
            <p className="wr-muted">{d.next_best_move.detail}</p>
            <p>
              Potential {formatINR(d.next_best_move.potential_revenue)}
              {d.next_best_move.expected_recovery_probability != null
                ? ` · ${formatPct(d.next_best_move.expected_recovery_probability)} recovery P`
                : ''}
            </p>
            {d.next_best_move.cta_href ? (
              <Link className="button-link" to={d.next_best_move.cta_href}>
                {d.next_best_move.cta} →
              </Link>
            ) : null}
          </div>
        </div>

        <ol className="wr-steps">
          {d.plan.map((step) => (
            <li key={step.step_id} className={`wr-step status-${step.status.toLowerCase()}`}>
              <div className="wr-step-top">
                <span className="wr-step-n">{step.order}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p className="wr-muted">{step.reason}</p>
                </div>
                <Badge tone={stepTone(step.status)}>{step.status}</Badge>
              </div>
              <div className="wr-step-meta">
                <span>{step.affected_case_count} cases</span>
                {step.expected_recovery != null ? (
                  <span>Expected {formatINRExact(step.expected_recovery)}</span>
                ) : null}
                {step.expected_impact ? <span>{step.expected_impact}</span> : null}
                {step.risk ? <span>Risk · {step.risk}</span> : null}
              </div>
              {step.policy_notes.length > 0 && (
                <ul className="wr-policy-notes">
                  {step.policy_notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              {!closed && step.requires_approval && step.status === 'PENDING' && (
                <div className="wr-step-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        step.step_id + '-ok',
                        () => warRoomApi.approveStep(d.incident_id, step.step_id),
                        `Approved: ${step.title}. Execute still goes through existing review / execute gates.`,
                      )
                    }
                  >
                    {busy === step.step_id + '-ok' ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        step.step_id + '-no',
                        () => warRoomApi.rejectStep(d.incident_id, step.step_id),
                        `Rejected: ${step.title}`,
                      )
                    }
                  >
                    Reject
                  </button>
                  {step.affected_case_ids[0] ? (
                    <Link className="button-link" to={`/cases/${step.affected_case_ids[0]}`}>
                      Review sample case →
                    </Link>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="wr-gate-note">
          War Room approve records coordinated intent only. Customer-facing actions still pass
          policy validation and existing Execute / Human Review — no bypass.
        </p>
      </section>

      {/* 5: Is it getting better */}
      <div className="wr-split">
        <section className="wr-panel">
          <h2>What changed</h2>
          <p className="wr-muted">{d.what_changed.window_label}</p>
          <ul className="wr-changes">
            {d.what_changed.items.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {typeof item.delta === 'number' && item.label.toLowerCase().includes('revenue')
                    ? formatINR(Math.abs(item.delta))
                    : item.delta}
                  <span className="wr-muted"> · {item.direction}</span>
                </strong>
              </li>
            ))}
          </ul>
          {d.what_changed.most_significant ? (
            <p className="wr-significant">{d.what_changed.most_significant}</p>
          ) : null}
        </section>

        <section className="wr-panel">
          <h2>Incident forecast · {d.forecast.horizon_label}</h2>
          <dl className="wr-kv">
            <dt>Expected recovery</dt>
            <dd>{formatINRExact(d.forecast.expected_recovery)}</dd>
            <dt>Expected unresolved</dt>
            <dd>{formatINRExact(d.forecast.expected_unresolved)}</dd>
            <dt>Resolution probability</dt>
            <dd>{formatPct(d.forecast.resolution_probability)}</dd>
          </dl>
          <ul className="wr-scenarios">
            {d.forecast.scenarios.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <strong>{formatINR(s.expected_recovery)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Affected cases */}
      <section className="wr-panel">
        <h2>Affected cases · {d.cases.length}</h2>
        <div className="table-wrap">
          <table className="data wr-cases">
            <thead>
              <tr>
                <th>Case</th>
                <th>Customer</th>
                <th className="num">Outstanding</th>
                <th>Cause</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.cases.slice(0, 40).map((c) => (
                <tr key={c.case_id}>
                  <td>
                    <Link className="row-link" to={`/cases/${c.case_id}`}>
                      {c.case_id}
                    </Link>
                  </td>
                  <td>{c.customer_name || '—'}</td>
                  <td className="num">{formatINR(c.outstanding_amount)}</td>
                  <td>{formatAction(c.root_cause)}</td>
                  <td>{c.priority_level ? <StatusBadge status={c.priority_level} /> : '—'}</td>
                  <td>
                    <StatusBadge status={c.current_state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Decisions + comment */}
      <div className="wr-split">
        <section className="wr-panel">
          <h2>Decision log</h2>
          {!d.decisions.length ? (
            <p className="wr-muted">No human decisions recorded yet.</p>
          ) : (
            <ul className="wr-decisions">
              {[...d.decisions].reverse().map((dec) => (
                <li key={dec.decision_id}>
                  <strong>{dec.kind}</strong>
                  <span className="wr-muted">
                    {' '}
                    · {dec.actor} · {formatTs(dec.timestamp)}
                  </span>
                  <p>{dec.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="wr-panel">
          <h2>Collaboration</h2>
          {!closed && (
            <form
              className="wr-comment"
              onSubmit={(e) => {
                e.preventDefault()
                if (!comment.trim()) return
                void run(
                  'comment',
                  () => warRoomApi.comment(d.incident_id, comment.trim()),
                  'Comment added',
                ).then(() => setComment(''))
              }}
            >
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a decision note or ask Finance to verify billing entity mapping…"
                rows={3}
              />
              <button type="submit" className="primary" disabled={!!busy || !comment.trim()}>
                {busy === 'comment' ? 'Posting…' : 'Add note'}
              </button>
            </form>
          )}
          <p className="wr-muted">
            Notes append to the immutable timeline. Privileged execute still requires existing
            gates.
          </p>
        </section>
      </div>

      {d.postmortem && (
        <section className="wr-panel wr-postmortem">
          <h2>Post-incident review</h2>
          <dl className="wr-kv">
            <dt>What happened</dt>
            <dd>{d.postmortem.what_happened}</dd>
            <dt>Why</dt>
            <dd>{d.postmortem.why}</dd>
            <dt>What Revive did</dt>
            <dd>{d.postmortem.what_revive_did}</dd>
            <dt>What worked</dt>
            <dd>{d.postmortem.what_worked}</dd>
            <dt>What failed</dt>
            <dd>{d.postmortem.what_failed}</dd>
            <dt>Recovered / unrecovered</dt>
            <dd>
              {formatINRExact(d.postmortem.recovered)} / {formatINRExact(d.postmortem.unrecovered)}{' '}
              ({formatPct(d.postmortem.recovery_rate)})
            </dd>
            <dt>Best / weakest intervention</dt>
            <dd>
              {formatAction(d.postmortem.best_intervention)} /{' '}
              {formatAction(d.postmortem.weakest_intervention)}
            </dd>
            <dt>Key learning</dt>
            <dd>{d.postmortem.key_learning}</dd>
            <dt>Recommended policy change</dt>
            <dd>
              {d.postmortem.recommended_policy_change}{' '}
              <Link to="/strategy-lab">Open Strategy Lab →</Link>
            </dd>
          </dl>
        </section>
      )}
    </div>
  )
}
