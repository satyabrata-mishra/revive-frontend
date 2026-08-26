import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { casesApi, executionApi, forecastApi, monitoringApi, policyApi, simulationApi } from '../api'
import type { AuditEvent, ExecuteResponse } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { Badge, ErrorState, Loading, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import {
  formatAction,
  formatCause,
  formatINR,
  formatINRExact,
  formatPct,
  formatTs,
} from '../utils/format'

function nest(obj: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams()
  const [executing, setExecuting] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const [execError, setExecError] = useState<string | null>(null)
  const [liveResult, setLiveResult] = useState<ExecuteResponse | null>(null)
  const [monitorMsg, setMonitorMsg] = useState<string | null>(null)
  const [previewMsg, setPreviewMsg] = useState<string | null>(null)

  // Day-16 contract: hydrate primarily from unified case; policy + executions are live overlays.
  const unified = useAsync(() => casesApi.get(caseId), [caseId])
  const policy = useAsync(() => policyApi.get(caseId), [caseId])
  const executions = useAsync(() => executionApi.listForCase(caseId), [caseId])
  const whatIf = useAsync(() => simulationApi.actionComparison(caseId), [caseId])
  const caseForecast = useAsync(() => forecastApi.case(caseId), [caseId])

  const executableAction = useMemo(() => {
    const auth = policy.data?.authorized_action
    const caseAuth = unified.data
      ? str(
          nest(
            unified.data.authorization as Record<string, unknown> | undefined,
            'authorized_action',
          ),
        )
      : undefined
    const strategyPrimary = unified.data
      ? str(
          nest(
            unified.data.strategy as Record<string, unknown> | undefined,
            'strategy',
            'primary_action',
          ),
        ) ||
        str(
          nest(
            unified.data.optimization as Record<string, unknown> | undefined,
            'decision',
            'selected_action',
          ),
        )
      : undefined
    return auth || caseAuth || strategyPrimary || null
  }, [policy.data, unified.data])

  const lastSuccessfulAction = useMemo(() => {
    const ok = (st: string) =>
      st === 'SUCCESS' || st === 'ALREADY_EXECUTED' || st.startsWith('SUCCESS')
    if (liveResult?.action && ok(liveResult.execution_status || '')) {
      return liveResult.action
    }
    const list = executions.data || []
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]
      if (ok(e.execution_status || '')) {
        return e.authorized_action || null
      }
    }
    const uExec = unified.data?.execution as Record<string, unknown> | undefined
    if (uExec && ok(String(uExec.status || ''))) {
      return str(uExec.authorized_action) || null
    }
    return null
  }, [liveResult, executions.data, unified.data])

  const caseState =
    liveResult?.current_state || unified.data?.current_state
  const sameActionAlreadyDone =
    !!executableAction &&
    !!lastSuccessfulAction &&
    executableAction === lastSuccessfulAction
  const caseClosed =
    caseState === 'CLOSED' ||
    liveResult?.pipeline_status === 'RECOVERED' ||
    liveResult?.pipeline_status === 'CLOSED'
  const policyUnlocked =
    (policy.data?.decision === 'APPROVED' || policy.data?.decision === 'MODIFIED') &&
    policy.data?.allowed === true &&
    !policy.data?.requires_human_approval
  // Human-approved cases may still show ESCALATED until reload; don't block Execute then.
  const caseEscalated = caseState === 'ESCALATED' && !policyUnlocked
  const nextActionReady =
    caseState === 'NEXT_ACTION_PROPOSED' &&
    !!executableAction &&
    !sameActionAlreadyDone

  const canExecute =
    !!executableAction &&
    policyUnlocked &&
    !caseClosed &&
    !caseEscalated &&
    !sameActionAlreadyDone

  const canAdvanceMonitoring =
    !!caseId &&
    !caseClosed &&
    (caseState === 'OUTCOME_MONITORING' ||
      (sameActionAlreadyDone && !nextActionReady && !caseEscalated))

  function executeLockReason(): string | null {
    if (canExecute) return null
    if (caseClosed) {
      return 'Case is closed after recovery — no further execute needed.'
    }
    if (policy.data?.decision === 'HUMAN_REVIEW' || policy.data?.requires_human_approval) {
      return 'Execute is locked until a human approves this case on Human Review.'
    }
    if (caseEscalated) {
      return 'Case is escalated — further autonomous execute is blocked.'
    }
    if (sameActionAlreadyDone && caseState === 'OUTCOME_MONITORING') {
      return (
        'This action was executed and Revive is monitoring the outcome. ' +
        'Use Advance monitoring to classify the result and unlock the next action.'
      )
    }
    if (sameActionAlreadyDone) {
      return (
        `${formatAction(lastSuccessfulAction)} already ran. ` +
        'Execute unlocks only when monitoring proposes a different next action.'
      )
    }
    return 'Execute is disabled until the backend authorizes an autonomous action (APPROVED / MODIFIED).'
  }

  const lockReason = executeLockReason()

  useEffect(() => {
    if (!caseId || !executableAction || !canExecute) {
      setPreviewMsg(null)
      return
    }
    let cancelled = false
    executionApi
      .preview(caseId, executableAction)
      .then((p) => {
        if (!cancelled) setPreviewMsg(p.message)
      })
      .catch(() => {
        if (!cancelled) setPreviewMsg(null)
      })
    return () => {
      cancelled = true
    }
  }, [caseId, executableAction, canExecute])

  async function refreshAfterExecute() {
    unified.reload()
    policy.reload()
    executions.reload()
  }

  async function handleExecute() {
    if (!executableAction || !canExecute) return
    setExecuting(true)
    setExecError(null)
    setMonitorMsg(null)
    try {
      const key = `${caseId}|${executableAction}|ui|${Date.now()}`
      const result = await executionApi.execute(caseId, executableAction, key)
      setLiveResult(result)
      if (result.monitoring_message) setMonitorMsg(result.monitoring_message)
      await refreshAfterExecute()
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }

  async function handleAdvanceMonitoring() {
    if (!caseId || !canAdvanceMonitoring) return
    setMonitoring(true)
    setExecError(null)
    try {
      const result = await monitoringApi.run(caseId)
      setMonitorMsg(result.message)
      setLiveResult((prev) =>
        prev
          ? {
              ...prev,
              current_state: result.current_state,
              next_action: result.next_action,
              monitoring_outcome: result.outcome_type,
              monitoring_message: result.message,
              pipeline_status: result.pipeline_status || prev.pipeline_status,
            }
          : prev,
      )
      await refreshAfterExecute()
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Monitoring failed')
    } finally {
      setMonitoring(false)
    }
  }

  if (unified.loading) return <Loading label={caseId} />
  if (unified.error) return <ErrorState message={unified.error} />
  if (!unified.data) return <ErrorState message="Case not found" />

  const c = unified.data
  const invoice = (c.invoice || {}) as Record<string, unknown>
  const customer = (c.customer || {}) as Record<string, unknown>
  const risk = nest(c.detection as Record<string, unknown>, 'risk') as
    | Record<string, unknown>
    | undefined
  const financial = nest(c.detection as Record<string, unknown>, 'financial') as
    | Record<string, unknown>
    | undefined
  const strategy = nest(c.strategy as Record<string, unknown>, 'strategy') as
    | Record<string, unknown>
    | undefined
  const diagnosisBlock = (nest(c.diagnosis as Record<string, unknown>, 'diagnosis') ||
    c.diagnosis ||
    {}) as Record<string, unknown>
  const optDecision = (nest(c.optimization as Record<string, unknown>, 'decision') ||
    {}) as Record<string, unknown>
  const outcomeBlock = (c.outcome || {}) as Record<string, unknown>
  const outcomeInner = (outcomeBlock.outcome || {}) as Record<string, unknown>
  const outcomeDecision = (outcomeBlock.decision || {}) as Record<string, unknown>
  const nextActionObj = outcomeBlock.next_action as Record<string, unknown> | undefined
  const ledger = (c.ledger || {}) as Record<string, unknown>
  const timelineEvents = ([...(c.audit_trail || [])] as AuditEvent[])
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ta = String(a.e.timestamp || '')
      const tb = String(b.e.timestamp || '')
      if (ta !== tb) return tb.localeCompare(ta)
      // Same / missing timestamp → later appends are more recent
      return b.i - a.i
    })
    .map(({ e }) => e)

  const candidateActions = (
    (strategy?.candidate_actions as unknown[]) ||
    (nest(c.strategy as Record<string, unknown>, 'candidate_actions') as unknown[]) ||
    []
  ) as Array<Record<string, unknown> | string>
  const whyCustomer =
    (nest(c.optimization as Record<string, unknown>, 'why_this_customer') as string[]) ||
    (nest(c.optimization as Record<string, unknown>, 'adaptive_decision', 'why_this_customer') as
      | string[]
      | undefined) ||
    []

  const policyDecision =
    policy.data?.decision ||
    str(nest(c.authorization as Record<string, unknown>, 'decision'))
  const bannerTone =
    policyDecision === 'APPROVED'
      ? 'ok'
      : policyDecision === 'BLOCKED'
        ? 'bad'
        : 'warn'

  const reasonText =
    str(strategy?.action_rationale) ||
    str(optDecision.reason) ||
    'Recommendation comes from the Revive decision engine (strategy + policy filters).'

  const diagnosisRoot =
    str(diagnosisBlock.primary_root_cause) ||
    str(diagnosisBlock.root_cause) ||
    str(nest(c.strategy as Record<string, unknown>, 'root_cause'))
  const diagnosisConfidence = num(diagnosisBlock.confidence) ?? num(diagnosisBlock.confidence_score)
  const diagnosisBand = str(diagnosisBlock.confidence_band)
  const diagnosisIntent = str(diagnosisBlock.payment_intent)
  const diagnosisEvidence = (diagnosisBlock.evidence as unknown[]) || []
  const selectedAction =
    str(optDecision.selected_action) ||
    str(strategy?.primary_action) ||
    executableAction
  const monitorOutcome =
    liveResult?.monitoring_outcome || str(outcomeInner.type) || undefined
  const nextAction =
    liveResult?.next_action ||
    str(nextActionObj?.action) ||
    undefined
  const amountRecovered =
    liveResult?.amount_recovered ?? num(ledger.amount_recovered) ?? num(outcomeInner.amount_recovered)
  const outstandingBefore =
    liveResult?.outstanding_before ??
    num(ledger.outstanding_before) ??
    num(outcomeInner.outstanding_before)
  const outstandingAfter =
    liveResult?.outstanding_after ??
    num(ledger.outstanding_after) ??
    num(outcomeInner.outstanding_after)

  return (
    <div>
      <div className="case-hero panel">
        <div className="case-hero-top">
          <div>
            <h1>{str(customer.customer_name) || str(customer.customer_id) || caseId}</h1>
            <div className="case-meta">
              <span>{caseId}</span>
              <span>·</span>
              <span>{str(invoice.invoice_id) || '—'}</span>
              <span>·</span>
              <span>{num(invoice.days_overdue) ?? '—'} days overdue</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {str(nest(c.detection as Record<string, unknown>, 'risk', 'priority_level')) && (
              <Badge tone="bad">
                {str(nest(c.detection as Record<string, unknown>, 'risk', 'priority_level'))}
              </Badge>
            )}
            <StatusBadge status={c.current_state} />
            <StatusBadge status={c.system_status} />
            <Link to="/monitoring" className="row-link" style={{ alignSelf: 'center' }}>
              Monitoring →
            </Link>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Outstanding</div>
            <div className="metric-value">
              {formatINRExact(num(invoice.outstanding_amount))}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Risk / Recovery P</div>
            <div className="metric-value" style={{ fontSize: '1.15rem' }}>
              {formatPct(num(risk?.risk_score))} / {formatPct(num(risk?.recovery_probability))}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Recovered</div>
            <div className="metric-value">
              {formatINRExact(amountRecovered)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <Section title="Why is this case risky?">
          <dl className="kv">
            <dt>Risk score</dt>
            <dd>{formatPct(num(risk?.risk_score))}</dd>
            <dt>Recovery probability</dt>
            <dd>{formatPct(num(risk?.recovery_probability))}</dd>
            <dt>Actionability</dt>
            <dd>{formatPct(num(risk?.actionability_score))}</dd>
            <dt>Expected recovery</dt>
            <dd>{formatINRExact(num(financial?.expected_recovery))}</dd>
          </dl>
        </Section>

        <Section title="Root Cause">
          <>
            <dl className="kv">
              <dt>Diagnosis</dt>
              <dd>{formatCause(diagnosisRoot)}</dd>
              <dt>Confidence</dt>
              <dd>
                {formatPct(diagnosisConfidence)}{' '}
                {diagnosisBand && <Badge tone="info">{diagnosisBand}</Badge>}
              </dd>
              <dt>Payment intent</dt>
              <dd>{diagnosisIntent || '—'}</dd>
            </dl>
            {diagnosisEvidence.length > 0 && (
              <>
                <h3 style={{ margin: '0.85rem 0 0.35rem', fontSize: '0.85rem' }}>
                  Evidence
                </h3>
                <ul className="evidence-list">
                  {diagnosisEvidence.slice(0, 6).map((e, i) => {
                    const text =
                      typeof e === 'string'
                        ? e
                        : e && typeof e === 'object' && 'description' in e
                          ? String((e as { description: unknown }).description)
                          : JSON.stringify(e)
                    return <li key={i}>{text}</li>
                  })}
                </ul>
              </>
            )}
          </>
        </Section>
      </div>

      <Section title="Revive's Recommendation">
        <>
          <dl className="kv">
            <dt>Recommended action</dt>
            <dd>{formatAction(selectedAction)}</dd>
            <dt>Expected recovery</dt>
            <dd>{formatINRExact(num(strategy?.expected_recovery))}</dd>
            <dt>Confidence</dt>
            <dd>{str(optDecision.selected_confidence) || '—'}</dd>
            <dt>Customer-aware</dt>
            <dd>
              {optDecision.customer_aware == null
                ? '—'
                : optDecision.customer_aware
                  ? 'Yes'
                  : 'No'}
            </dd>
          </dl>
          <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {reasonText}
          </p>
          {whyCustomer.length ? (
            <ul className="evidence-list" style={{ marginTop: '0.75rem' }}>
              {whyCustomer.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
          {candidateActions.length ? (
            <>
              <h3 style={{ margin: '1rem 0 0.35rem', fontSize: '0.85rem' }}>
                Alternative actions
              </h3>
              <ul className="alt-actions">
                {candidateActions.map((a, i) => {
                  const action =
                    typeof a === 'string' ? a : str((a as Record<string, unknown>).action)
                  const allowed =
                    typeof a === 'object'
                      ? (a as Record<string, unknown>).allowed !== false
                      : true
                  const expected =
                    typeof a === 'object'
                      ? num((a as Record<string, unknown>).expected_recovery)
                      : undefined
                  return (
                    <li
                      key={`${action}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                      }}
                    >
                      <span>
                        {formatAction(action)}{' '}
                        {!allowed && <Badge tone="bad">blocked</Badge>}
                        {action === selectedAction && (
                          <Badge tone="ok">recommended</Badge>
                        )}
                      </span>
                      <strong>{formatINR(expected)}</strong>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </>
      </Section>

      <div className="grid-2">
        <Section title="Recovery Forecast">
          {caseForecast.loading && <Loading size="sm" label="Forecast" />}
          {caseForecast.data && (
            <>
              <p className="muted-note">{caseForecast.data.disclaimer}</p>
              <dl className="kv">
                <dt>Outstanding</dt>
                <dd>{formatINRExact(caseForecast.data.current_outstanding)}</dd>
                <dt>Expected recovery</dt>
                <dd>{formatINRExact(caseForecast.data.expected_recovery)}</dd>
                <dt>Expected date</dt>
                <dd>{caseForecast.data.expected_recovery_date || '—'}</dd>
                <dt>Expected remaining</dt>
                <dd>{formatINRExact(caseForecast.data.expected_remaining_balance)}</dd>
                <dt>Recovery P</dt>
                <dd>{formatPct(caseForecast.data.recovery_probability)}</dd>
              </dl>
            </>
          )}
        </Section>

        <Section title="What If?">
          {whatIf.loading && <Loading size="sm" label="What-if" />}
          {whatIf.data && (
            <>
              <p className="muted-note">{whatIf.data.disclaimer}</p>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatIf.data.actions.map((row) => (
                      <tr
                        key={row.action}
                        className={row.is_recommended ? 'row-recommended' : undefined}
                      >
                        <td>
                          {formatAction(row.action)}
                          {row.is_recommended && (
                            <Badge tone="ok">recommended</Badge>
                          )}
                          {!row.allowed && <Badge tone="bad">blocked</Badge>}
                        </td>
                        <td>
                          <strong>{formatINRExact(row.expected_recovery)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {whatIf.data.recommended_action && (
                <div className="decision-banner ok" style={{ marginTop: '0.85rem' }}>
                  Revive recommends: {formatAction(whatIf.data.recommended_action)}
                </div>
              )}
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                {whatIf.data.recommendation_reason}
              </p>
            </>
          )}
        </Section>
      </div>

      <Section title="Policy Validation">
        {policy.loading && <Loading />}
        {policy.data && (
          <>
            <div className={`decision-banner ${bannerTone}`}>
              {policy.data.decision === 'APPROVED' && 'APPROVED'}
              {policy.data.decision === 'HUMAN_REVIEW' && 'HUMAN REVIEW REQUIRED'}
              {policy.data.decision === 'BLOCKED' && 'BLOCKED'}
              {policy.data.decision === 'MODIFIED' && 'MODIFIED'}
              {!['APPROVED', 'HUMAN_REVIEW', 'BLOCKED', 'MODIFIED'].includes(
                policy.data.decision || '',
              ) &&
                (policy.data.decision || 'UNKNOWN')}
              {policy.data.policy_version
                ? ` · policy ${policy.data.policy_version}`
                : ''}
            </div>
            <dl className="kv">
              <dt>Requested</dt>
              <dd>{formatAction(policy.data.requested_action)}</dd>
              <dt>Authorized</dt>
              <dd>{formatAction(policy.data.authorized_action)}</dd>
              {policy.data.review_status && (
                <>
                  <dt>Human review</dt>
                  <dd>{policy.data.review_status}</dd>
                </>
              )}
              {policy.data.reviewed_at && (
                <>
                  <dt>Reviewed at</dt>
                  <dd>{formatTs(policy.data.reviewed_at)}</dd>
                </>
              )}
            </dl>
            {policy.data.reviewer_note && (
              <div className="reviewer-note" style={{ marginTop: '0.85rem' }}>
                <div className="metric-label">Reviewer note</div>
                <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap' }}>
                  {policy.data.reviewer_note}
                </p>
              </div>
            )}
            <ul className="rule-list" style={{ marginTop: '0.75rem' }}>
              {(policy.data.rules_evaluated || []).map((rule) => {
                const passed = policy.data!.rules_passed.includes(rule)
                const check = policy.data!.checks?.[rule]
                return (
                  <li key={rule} className={passed ? 'pass' : 'fail'}>
                    {rule.replace(/_/g, ' ')}
                    {check?.message ? ` — ${check.message}` : ''}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Section>

      <Section title="Execute Action">
        <div className="execute-panel">
          <div>
            <div className="metric-label">Authorized action</div>
            <div className="metric-value" style={{ fontSize: '1.2rem' }}>
              {formatAction(executableAction)}
            </div>
            {previewMsg && (
              <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                Preview: {previewMsg}
              </p>
            )}
            {!canExecute && lockReason && (
              <p style={{ margin: '0.5rem 0 0', color: 'var(--warn)', fontSize: '0.9rem' }}>
                {lockReason}
              </p>
            )}
            {canExecute &&
              (policy.data?.policy_reasons || []).some((r) =>
                String(r).toLowerCase().includes('human reviewer'),
              ) && (
                <p style={{ margin: '0.5rem 0 0', color: 'var(--ok)', fontSize: '0.9rem' }}>
                  Human review approved — Execute is now unlocked for this case.
                </p>
              )}
            {canExecute && nextActionReady && (
              <p style={{ margin: '0.5rem 0 0', color: 'var(--ok)', fontSize: '0.9rem' }}>
                Monitoring proposed {formatAction(executableAction)} — Execute is unlocked for
                this next step.
              </p>
            )}
            {canExecute && !nextActionReady && (
              <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                One authorized run per action. After execute, monitoring runs automatically and
                may unlock a different next action.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button
              type="button"
              className="primary"
              disabled={!canExecute || executing || monitoring}
              onClick={handleExecute}
              aria-busy={executing}
            >
              {executing ? (
                <span className="loading-spinner loading-spinner-sm on-dark" aria-hidden="true" />
              ) : (
                'Execute Action'
              )}
            </button>
            {canAdvanceMonitoring && (
              <button
                type="button"
                disabled={monitoring || executing}
                onClick={handleAdvanceMonitoring}
                aria-busy={monitoring}
              >
                {monitoring ? (
                  <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
                ) : (
                  'Advance monitoring'
                )}
              </button>
            )}
          </div>
        </div>
        {execError && (
          <p style={{ color: 'var(--bad)', marginTop: '0.75rem' }}>{execError}</p>
        )}
        {(monitorMsg || liveResult?.monitoring_message) && (
          <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {monitorMsg || liveResult?.monitoring_message}
          </p>
        )}
        {liveResult && (
          <div
            className={`decision-banner ${
              liveResult.current_state === 'CLOSED' ||
              liveResult.execution_status === 'SUCCESS' ||
              liveResult.pipeline_status === 'RECOVERED'
                ? 'ok'
                : liveResult.pipeline_status === 'PARTIAL_RECOVERY' ||
                    liveResult.execution_status === 'ALREADY_EXECUTED' ||
                    liveResult.current_state === 'NEXT_ACTION_PROPOSED'
                  ? 'warn'
                  : String(liveResult.execution_status || '').startsWith('ABORTED') ||
                      liveResult.execution_status === 'FAILURE' ||
                      liveResult.execution_status === 'SKIPPED_HUMAN_ROUTE' ||
                      liveResult.current_state === 'ESCALATED'
                    ? 'bad'
                    : 'warn'
            }`}
            style={{ marginTop: '0.85rem' }}
          >
            {liveResult.pipeline_status === 'RECOVERED' ||
            liveResult.current_state === 'CLOSED' ||
            (liveResult.execution_status === 'SUCCESS' &&
              (liveResult.outstanding_after ?? 1) <= 0.01 &&
              (liveResult.amount_recovered || 0) > 0)
              ? 'FULL RECOVERY'
              : liveResult.pipeline_status === 'PARTIAL_RECOVERY'
                ? 'PARTIAL RECOVERY'
                : liveResult.current_state === 'NEXT_ACTION_PROPOSED' ||
                    liveResult.next_action
                  ? `EXECUTED · NEXT ${formatAction(liveResult.next_action || executableAction)}`
                  : liveResult.execution_status === 'SUCCESS'
                    ? 'EXECUTED — MONITORING'
                    : liveResult.execution_status}
            {liveResult.execution_id ? ` · ${liveResult.execution_id}` : ''}
            {liveResult.abort_reason ? ` · ${liveResult.abort_reason}` : ''}
            {' · '}
            recovered {formatINRExact(liveResult.amount_recovered)}
            {liveResult.monitoring_outcome
              ? ` · outcome ${liveResult.monitoring_outcome}`
              : liveResult.next_stage
                ? ` · next ${liveResult.next_stage}`
                : ''}
          </div>
        )}
        {liveResult?.audit_events?.length ? (
          <div className="timeline-scroll" style={{ marginTop: '0.75rem' }}>
            <ul className="timeline">
              {[...liveResult.audit_events].reverse().map((ev, i) => (
                <li key={`${ev}-${i}`}>
                  <span className="ts">live</span>
                  <span>
                    <strong>{ev}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <div className="grid-2">
        <Section title="Execution Timeline">
          {timelineEvents.length ? (
            <div className="timeline-scroll">
              <ul className="timeline">
                {timelineEvents.map((e, i) => (
                  <li key={`${e.event}-${i}`}>
                    <span className="ts">{formatTs(e.timestamp)}</span>
                    <span>
                      <strong>{e.event}</strong>
                      {e.detail != null && e.detail !== '' ? (
                        <span style={{ color: 'var(--muted)' }}>
                          {' '}
                          — {String(e.detail)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>No audit events.</p>
          )}
          {executions.data && executions.data.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Latest stored execution:{' '}
              {executions.data[executions.data.length - 1].execution_id} ·{' '}
              {executions.data[executions.data.length - 1].execution_status}
            </p>
          )}
        </Section>

        <Section title="Recovery">
          <>
            {(monitorOutcome === 'FULL_RECOVERY' ||
              ((outstandingAfter ?? 1) <= 0.01 && (amountRecovered || 0) > 0)) && (
              <div className="decision-banner ok">FULL RECOVERY</div>
            )}
            {monitorOutcome === 'PARTIAL_RECOVERY' && (
              <div className="decision-banner warn">PARTIAL RECOVERY</div>
            )}
            <dl className="kv">
              <dt>Before</dt>
              <dd>{formatINRExact(outstandingBefore)}</dd>
              <dt>Recovered</dt>
              <dd>{formatINRExact(amountRecovered)}</dd>
              <dt>Remaining</dt>
              <dd>{formatINRExact(outstandingAfter)}</dd>
              <dt>Recovery rate</dt>
              <dd>{formatPct(num(ledger.recovery_rate))}</dd>
              <dt>Outcome</dt>
              <dd>{monitorOutcome || '—'}</dd>
              <dt>Loop decision</dt>
              <dd>{str(outcomeDecision.loop_decision) || '—'}</dd>
            </dl>
            {nextAction && (
              <div className="decision-banner warn" style={{ marginTop: '0.85rem' }}>
                Next action: {formatAction(nextAction)}
                {nextActionObj?.requires_policy_validation
                  ? ' · policy validation required'
                  : ''}
              </div>
            )}
            {str(outcomeDecision.stop_reason) && (
              <p style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                Stop reason: {str(outcomeDecision.stop_reason)}
              </p>
            )}
          </>
        </Section>
      </div>
    </div>
  )
}
