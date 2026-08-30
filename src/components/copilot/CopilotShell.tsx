import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { copilotApi } from '../../api/copilot'
import type {
  CopilotCaseContext,
  CopilotChatResponse,
  CopilotUiAction,
} from '../../api/copilot'
import { ConfirmDialog } from '../ConfirmDialog'
import { Badge, ErrorState, Loading } from '../ui'
import { executionApi, reviewApi } from '../../api'
import {
  formatAction,
  formatCause,
  formatINRExact,
  formatPct,
} from '../../utils/format'

type Turn = {
  role: 'user' | 'assistant'
  text: string
  payload?: CopilotChatResponse
}

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>
    }
    return <span key={i}>{p}</span>
  })
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="copilot-field">
      <span className="copilot-field-label">{label}</span>
      <div className="copilot-field-value">
        <div>{children}</div>
        {hint ? <div className="copilot-field-hint">{hint}</div> : null}
      </div>
    </div>
  )
}

export function CopilotShell() {
  const { caseId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const fromReview = searchParams.get('from') === 'review'

  const [ctx, setCtx] = useState<CopilotCaseContext | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<{
    action: string
    previewMsg: string
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const bootstrapped = useRef(false)

  useEffect(() => {
    if (!caseId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setSessionId(null)
    setTurns([])
    bootstrapped.current = false
    Promise.all([copilotApi.context(caseId), copilotApi.suggestions(caseId)])
      .then(([context, sug]) => {
        if (cancelled) return
        setCtx(context)
        setSuggestions(sug.suggestions)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  useEffect(() => {
    if (!caseId || loading || bootstrapped.current) return
    if (fromReview) {
      bootstrapped.current = true
      void ask('Give me an executive summary for human review')
    }
  }, [caseId, loading, fromReview])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns, sending])

  async function ask(message: string) {
    if (!caseId || !message.trim() || sending) return
    const text = message.trim()
    setSending(true)
    setSendError(null)
    setFlash(null)
    setTurns((t) => [...t, { role: 'user', text }])
    setInput('')
    try {
      const res = await copilotApi.chat({
        case_id: caseId,
        message: text,
        session_id: sessionId || undefined,
      })
      setSessionId(res.session_id)
      setTurns((t) => [...t, { role: 'assistant', text: res.answer, payload: res }])
      if (res.suggested_followups?.length) {
        setSuggestions(res.suggested_followups)
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Copilot request failed')
      setTurns((t) => t.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  async function onUiAction(action: CopilotUiAction) {
    if (action.type === 'confirm_execute' && action.action) {
      try {
        const preview = await copilotApi.actionPreview(caseId, action.action)
        setConfirm({ action: action.action, previewMsg: preview.message })
      } catch (e) {
        setFlash(e instanceof Error ? e.message : 'Preview failed')
      }
      return
    }
    if (action.href) {
      window.location.assign(action.href)
    }
  }

  async function confirmExecute() {
    if (!confirm || !caseId) return
    setConfirmBusy(true)
    try {
      if (ctx?.requires_human_approval || ctx?.open_dispute) {
        await reviewApi.escalate(caseId, 'Escalated from Case Assist')
        setFlash('Escalated via Human Review — Case Assist does not bypass policy.')
      } else {
        const key = `${caseId}|${confirm.action}|assist|${Date.now()}`
        const res = await executionApi.execute(caseId, confirm.action, key)
        setFlash(
          `Execution submitted: ${res.execution_status || 'done'}` +
            (res.abort_reason ? ` (${res.abort_reason})` : ''),
        )
      }
      setConfirm(null)
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Execute failed')
    } finally {
      setConfirmBusy(false)
    }
  }

  if (loading) return <Loading label="Loading Case Assist…" />
  if (loadError) return <ErrorState message={loadError} />
  if (!ctx) return <ErrorState message="Case context unavailable" />

  const latestRec =
    [...turns].reverse().find((t) => t.payload?.recommendation)?.payload?.recommendation ||
    null
  const latestAlts =
    [...turns].reverse().find((t) => (t.payload?.alternatives || []).length)?.payload
      ?.alternatives || []
  const latestEvidence =
    [...turns].reverse().find((t) => (t.payload?.evidence || []).length)?.payload?.evidence ||
    []
  const recommended = latestRec?.action || ctx.recommended_action

  return (
    <div className="copilot-page">
      <header className="copilot-header">
        <div className="copilot-header-copy">
          <p className="copilot-eyebrow">Operator assist · this case</p>
          <h1>Case Assist</h1>
        </div>
        <div className="copilot-header-meta">
          <Badge tone="info">{caseId}</Badge>
          <Link className="button-link" to={`/cases/${caseId}`}>
            Case overview
          </Link>
          <Link className="button-link" to={`/review?q=${encodeURIComponent(caseId)}`}>
            Human Review
          </Link>
        </div>
      </header>

      {flash && <div className="decision-banner warn copilot-flash">{flash}</div>}

      <div className="copilot-grid">
        <aside className="copilot-panel copilot-context">
          <div className="copilot-panel-head">
            <h2>Case context</h2>
            <span className="copilot-panel-tag" title={ctx.current_state || undefined}>
              {formatAction(ctx.current_state)}
            </span>
          </div>

          <div className="copilot-fields">
            <Field label="Customer" hint={ctx.customer_id}>
              {ctx.customer_name || '—'}
            </Field>
            <Field label="Risk">{ctx.risk_profile || '—'}</Field>
            <Field
              label="Invoice"
              hint={
                <>
                  {formatINRExact(ctx.outstanding_amount)} · {ctx.days_overdue ?? '—'}d ·{' '}
                  {ctx.invoice_status || '—'}
                </>
              }
            >
              {ctx.invoice_id || '—'}
            </Field>
            <Field label="Priority">{ctx.priority_level || '—'}</Field>
            <Field label="Recovery p">{formatPct(ctx.recovery_probability)}</Field>
            <Field label="Root cause" hint={formatPct(ctx.root_cause_confidence)}>
              {formatCause(ctx.root_cause)}
            </Field>
            <Field label="Payment intent">{ctx.payment_intent || '—'}</Field>
            <Field label="Expected recovery">{formatINRExact(ctx.expected_recovery)}</Field>
            <Field label="Policy">{ctx.policy_decision || '—'}</Field>
          </div>

          {ctx.open_dispute && (
            <div className="decision-banner bad copilot-inline-banner">
              Open dispute — contact recovery blocked
            </div>
          )}

          {latestEvidence.length > 0 && (
            <div className="copilot-evidence-block">
              <h3>Evidence</h3>
              <ul>
                {latestEvidence.map((e, i) => (
                  <li key={i}>
                    <strong>{e.label}</strong>
                    <span>{e.value}</span>
                    {e.source ? <em>{e.source}</em> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="copilot-panel copilot-main">
          <div className="copilot-panel-head">
            <h2>Assist</h2>
            {sessionId ? (
              <span className="copilot-panel-tag muted">{sessionId}</span>
            ) : (
              <span className="copilot-panel-tag muted">New session</span>
            )}
          </div>

          <div className="copilot-thread">
            {turns.length === 0 && (
              <div className="copilot-empty">
                <p className="copilot-empty-title">Start with a suggested question</p>
                <p className="copilot-empty-copy">
                  Case Assist stays on this case — diagnosis, actions, policy, and drafts. For
                  portfolio analytics, use ReviveIQ.
                </p>
                <div className="copilot-suggestions">
                  {suggestions.map((s) => (
                    <button key={s} type="button" disabled={sending} onClick={() => void ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div
                key={i}
                className={`copilot-bubble ${t.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="copilot-bubble-role">
                  <span>{t.role === 'user' ? 'You' : 'Assist'}</span>
                  {t.payload?.intent ? (
                    <Badge tone="neutral">{t.payload.intent.replace(/_/g, ' ')}</Badge>
                  ) : null}
                </div>
                <div className="copilot-bubble-body">
                  {t.role === 'assistant'
                    ? t.text.split('\n').map((line, li) =>
                        line.trim() === '' ? (
                          <br key={li} />
                        ) : (
                          <p key={li}>{renderMarkdownLite(line)}</p>
                        ),
                      )
                    : t.text}
                </div>
                {t.payload?.handoff && (
                  <div className="copilot-inline-actions">
                    <Link
                      className="primary button-link"
                      to={t.payload.handoff.href || '/intelligence'}
                    >
                      Ask ReviveIQ
                    </Link>
                  </div>
                )}
                {t.payload?.ui_actions?.length ? (
                  <div className="copilot-inline-actions">
                    {t.payload.ui_actions.map((a, ai) =>
                      a.href && a.type !== 'confirm_execute' ? (
                        <Link key={ai} className="button-link" to={a.href}>
                          {a.label}
                        </Link>
                      ) : (
                        <button
                          key={ai}
                          type="button"
                          className={a.type === 'confirm_execute' ? 'primary' : undefined}
                          onClick={() => void onUiAction(a)}
                        >
                          {a.label}
                        </button>
                      ),
                    )}
                  </div>
                ) : null}
                {t.payload?.next_step ? (
                  <p className="copilot-next-step">Next: {t.payload.next_step}</p>
                ) : null}
              </div>
            ))}

            {sending && (
              <div className="copilot-bubble assistant copilot-thinking">
                <div className="copilot-bubble-role">
                  <span>Assist</span>
                </div>
                <p>Analyzing case · checking policy · preparing recommendation…</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {turns.length > 0 && suggestions.length > 0 && (
            <div className="copilot-suggestions compact">
              {suggestions.slice(0, 4).map((s) => (
                <button key={s} type="button" disabled={sending} onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="copilot-composer"
            onSubmit={(e) => {
              e.preventDefault()
              void ask(input)
            }}
          >
            <div className="copilot-composer-box">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this case…"
                disabled={sending}
                aria-label="Copilot message"
                autoComplete="off"
              />
              <button type="submit" className="primary copilot-ask-btn" disabled={sending || !input.trim()}>
                Ask
              </button>
            </div>
          </form>
          {sendError && <p className="copilot-error">{sendError}</p>}
        </section>

        <aside className="copilot-panel copilot-actions">
          <div className="copilot-panel-head">
            <h2>Action panel</h2>
          </div>

          <div className="copilot-rec-card">
            <div className="metric-label">Recommended action</div>
            <div className="copilot-rec-action">{formatAction(recommended)}</div>
            <div className="copilot-rec-metrics">
              <div>
                <span>Confidence</span>
                <strong>{latestRec?.confidence || '—'}</strong>
              </div>
              <div>
                <span>Expected</span>
                <strong>
                  {formatINRExact(latestRec?.expected_recovery ?? ctx.expected_recovery)}
                </strong>
              </div>
              <div>
                <span>Recovery p</span>
                <strong>
                  {formatPct(latestRec?.recovery_probability ?? ctx.recovery_probability)}
                </strong>
              </div>
              <div>
                <span>Policy</span>
                <strong>{ctx.policy_decision || '—'}</strong>
              </div>
            </div>
            {(latestRec?.why || []).length > 0 && (
              <ul className="copilot-why-list">
                {latestRec!.why!.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="copilot-inline-actions">
              <button
                type="button"
                className="primary"
                disabled={sending}
                onClick={() => void ask('What should I do next?')}
              >
                Review recommendation
              </button>
              <Link className="button-link" to={`/cases/${caseId}#execute-action`}>
                Open execute
              </Link>
            </div>
          </div>

          <div className="copilot-side-block">
            <h3>Alternatives</h3>
            {latestAlts.length > 0 ? (
              <ul className="copilot-alt-list">
                {latestAlts.slice(0, 5).map((a) => (
                  <li key={a.action}>
                    <button
                      type="button"
                      className="linkish"
                      disabled={sending}
                      onClick={() => void ask(`What if we use ${a.action} instead?`)}
                    >
                      {formatAction(a.action)}
                    </button>
                    <span>
                      {formatINRExact(a.expected_recovery)} · {a.confidence || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="copilot-side-empty">Ask “What alternatives do I have?” to compare.</p>
            )}
            <button
              type="button"
              disabled={sending}
              onClick={() => void ask('What alternatives do I have?')}
            >
              Compare actions
            </button>
          </div>

          <div className="copilot-side-block">
            <h3>Communication</h3>
            <div className="copilot-side-stack">
              <button
                type="button"
                disabled={sending}
                onClick={() => void ask('Draft a customer message')}
              >
                Draft message
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void ask('Make it firm but non-aggressive')}
              >
                Firm tone
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void ask('Can I execute this action automatically?')}
              >
                Can I execute?
              </button>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title="Confirm execution"
        message={
          confirm
            ? `Execute ${formatAction(confirm.action)} for ${ctx.customer_name || caseId} · outstanding ${formatINRExact(ctx.outstanding_amount)} · policy ${ctx.policy_decision || '—'}. ${confirm.previewMsg} Case Assist uses the existing execution API — it never bypasses policy.`
            : ''
        }
        confirmLabel={confirmBusy ? 'Working…' : 'Confirm & Execute'}
        cancelLabel="Cancel"
        busy={confirmBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirmExecute()}
      />
    </div>
  )
}
