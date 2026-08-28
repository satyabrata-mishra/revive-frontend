import { startTransition, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { simulatorApi } from '../api'
import type { CaseSummary } from '../api/types'
import { StatusBadge } from '../components/StatusBadge'
import { Badge, ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import {
  RECOVERY_ACTIONS,
  STRATEGY_PRESETS,
  countContactSteps,
  defaultSeed,
  scheduleStepDays,
  type OptimizationObjective,
  type SimulationResult,
  type SimulatorCaseState,
  type StrategyStepInput,
  validateStrategy,
} from '../lib/simulator'
import { formatAction, formatCause, formatINRExact, formatPct, formatTs } from '../utils/format'

const OBJECTIVES: { id: OptimizationObjective; label: string }[] = [
  { id: 'max_net', label: 'Maximum net recovery' },
  { id: 'max_recovery', label: 'Maximum recovery' },
  { id: 'fastest', label: 'Fastest recovery' },
  { id: 'balanced', label: 'Balanced' },
]

/** Integer field that allows empty while typing and never shows leading zeros (e.g. 04 → 4). */
function IntInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(() => String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  function commit(raw: string) {
    if (raw.trim() === '') {
      setText(String(min))
      onChange(min)
      return
    }
    let n = parseInt(raw, 10)
    if (Number.isNaN(n)) {
      setText(String(value))
      return
    }
    if (max != null) n = Math.min(max, n)
    n = Math.max(min, n)
    setText(String(n))
    onChange(n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          setText('')
          return
        }
        if (!/^\d+$/.test(raw)) return
        let n = parseInt(raw, 10)
        if (Number.isNaN(n)) return
        if (max != null) n = Math.min(max, n)
        setText(String(n))
        onChange(n)
      }}
      onBlur={() => {
        setFocused(false)
        commit(text)
      }}
    />
  )
}

function sourceTag(src?: string) {
  if (!src) return null
  const tone =
    src === 'observed' ? 'ok' : src === 'user-configured' || src === 'model-estimated' ? 'info' : 'neutral'
  return (
    <Badge tone={tone as 'ok' | 'info' | 'neutral'} title={src}>
      {src}
    </Badge>
  )
}

function riskTone(risk: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (risk === 'LOW') return 'ok'
  if (risk === 'MEDIUM') return 'warn'
  if (risk === 'HIGH') return 'bad'
  return 'neutral'
}

export function SimulatorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCase = searchParams.get('caseId') || ''

  const [caseQuery, setCaseQuery] = useState('')
  const debouncedQ = useDebouncedValue(caseQuery, 250)
  const [caseId, setCaseId] = useState(initialCase)
  const [pickingCase, setPickingCase] = useState(!initialCase)
  const [caseState, setCaseState] = useState<SimulatorCaseState | null>(null)
  const [caseError, setCaseError] = useState<string | null>(null)
  const [caseLoading, setCaseLoading] = useState(false)

  const [steps, setSteps] = useState<StrategyStepInput[]>([
    { action: 'SEND_REMINDER', delay_days: 0 },
    { action: 'SEND_PAYMENT_LINK', delay_days: 3 },
  ])
  const [scenarioName, setScenarioName] = useState('Balanced recovery')
  const [scenarioDescription, setScenarioDescription] = useState('')
  const [paymentProbability, setPaymentProbability] = useState(0.45)
  const [responseProbability, setResponseProbability] = useState(0.55)
  const [partialProbability, setPartialProbability] = useState(0.25)
  const [recoveryWindow, setRecoveryWindow] = useState(21)
  const [maxContacts, setMaxContacts] = useState(5)
  const [runs, setRuns] = useState(5000)
  const [seed, setSeed] = useState(() => defaultSeed())
  const [objective, setObjective] = useState<OptimizationObjective>('max_net')

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [latest, setLatest] = useState<SimulationResult | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [historyTick, setHistoryTick] = useState(0)

  const cases = useAsync(
    () => simulatorApi.listCases(debouncedQ || undefined, 40),
    [debouncedQ],
  )

  useEffect(() => {
    if (!caseId) {
      setCaseState(null)
      return
    }
    let cancelled = false
    setCaseLoading(true)
    setCaseError(null)
    simulatorApi
      .getCaseState(caseId)
      .then((state) => {
        if (cancelled) return
        setCaseState(state)
        setRecoveryWindow(state.recovery_window_days)
        setMaxContacts(state.max_contacts)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setCaseState(null)
        setCaseError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setCaseLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  useEffect(() => {
    if (initialCase && initialCase !== caseId) setCaseId(initialCase)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL once / on param change
  }, [initialCase])

  const validation = useMemo(() => {
    if (!caseState) return null
    return validateStrategy(
      { ...caseState, recovery_window_days: recoveryWindow, max_contacts: maxContacts },
      steps,
      { recovery_window_days: recoveryWindow, max_contacts: maxContacts },
    )
  }, [caseState, steps, recoveryWindow, maxContacts])

  const stepDays = useMemo(() => scheduleStepDays(steps), [steps])
  const contactCount = useMemo(() => countContactSteps(steps), [steps])
  const lastStrategyDay = stepDays.length ? stepDays[stepDays.length - 1] : 0

  const history = useMemo(
    () => simulatorApi.listHistory(caseId || undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseId, historyTick, latest],
  )

  const comparison = useMemo(() => {
    const selected = history
      .filter((h) => compareIds.includes(h.simulation_id))
      .map((h) => h.result)
    if (selected.length < 2) {
      if (latest && selected.length === 1) {
        return simulatorApi.compare([selected[0], latest], objective)
      }
      return null
    }
    return simulatorApi.compare(selected, objective)
  }, [history, compareIds, objective, latest])

  function selectCase(id: string) {
    setCaseId(id)
    setSearchParams(id ? { caseId: id } : {})
    setLatest(null)
    setCompareIds([])
    setPickingCase(!id)
    if (id) setCaseQuery('')
  }

  function applyPreset(presetId: string) {
    const preset = STRATEGY_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setSteps(preset.steps.map((s) => ({ ...s })))
    setScenarioName(preset.name)
    setScenarioDescription(preset.description)
  }

  function addStep() {
    setSteps((prev) => [...prev, { action: 'SEND_REMINDER', delay_days: 3 }])
  }

  function updateStep(index: number, patch: Partial<StrategyStepInput>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  async function runSim() {
    if (!caseId || !caseState) return
    setRunning(true)
    setRunError(null)
    try {
      const result = await simulatorApi.simulate({
        case_id: caseId,
        case_state: {
          ...caseState,
          recovery_window_days: recoveryWindow,
          max_contacts: maxContacts,
        },
        strategy: steps,
        scenario_name: scenarioName || 'Untitled scenario',
        scenario_description: scenarioDescription || undefined,
        parameters: {
          payment_probability: paymentProbability,
          response_probability: responseProbability,
          partial_payment_probability: partialProbability,
          recovery_window_days: recoveryWindow,
          max_contacts: maxContacts,
          simulation_runs: runs,
          seed,
        },
        objective,
      })
      startTransition(() => {
        setLatest(result)
        simulatorApi.saveScenario(result)
        setHistoryTick((t) => t + 1)
        setCompareIds((ids) => {
          const next = [result.simulation_id, ...ids.filter((id) => id !== result.simulation_id)]
          return next.slice(0, 3)
        })
      })
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  function applyWhatIf(kind: 'half' | 'wait3' | 'escalate' | 'link') {
    if (kind === 'half') setPaymentProbability(0.5)
    if (kind === 'wait3') {
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? s : { ...s, delay_days: Math.max(s.delay_days, 3) })),
      )
    }
    if (kind === 'escalate') {
      setSteps([{ action: 'ESCALATE_TO_ACCOUNT_MANAGER', delay_days: 0 }])
      setScenarioName('Escalate immediately')
    }
    if (kind === 'link') {
      setSteps((prev) =>
        prev.map((s) =>
          s.action === 'SEND_REMINDER' ? { ...s, action: 'SEND_PAYMENT_LINK' } : s,
        ),
      )
    }
  }

  const caseOptions: CaseSummary[] = cases.data?.items || []

  return (
    <div className="simulator-page">
      <div className="page-head">
        <div>
          <h1>Revive Recovery Simulator</h1>
          <p>What recovery strategy should we simulate? Model outcomes without executing actions.</p>
        </div>
      </div>

      <div className="simulator-banner" role="status">
        SIMULATED — NO ACTION WILL BE EXECUTED
      </div>

      <Section
        title="Case"
        right={
          caseId && caseState && !pickingCase ? (
            <button type="button" className="simulator-change-case" onClick={() => setPickingCase(true)}>
              Change case
            </button>
          ) : caseId && pickingCase ? (
            <button type="button" className="simulator-change-case" onClick={() => setPickingCase(false)}>
              Keep current
            </button>
          ) : null
        }
      >
        {caseId && caseState && !pickingCase ? (
          <div className="simulator-active-case">
            <div className="simulator-active-case-head">
              <div>
                <div className="simulator-active-kicker">Simulating</div>
                <h3 className="simulator-active-title">{caseState.case_id}</h3>
                <p className="simulator-active-customer">
                  {caseState.customer_name || 'Unknown customer'}
                  {caseState.invoice_id ? ` · ${caseState.invoice_id}` : ''}
                </p>
              </div>
              <Link to={`/cases/${caseId}`} className="button-link">
                View case details →
              </Link>
            </div>
            <div className="simulator-active-stats">
              <div>
                <span className="metric-label">Outstanding</span>
                <strong>{formatINRExact(caseState.outstanding)}</strong>
              </div>
              <div>
                <span className="metric-label">Days overdue</span>
                <strong>{caseState.days_overdue}</strong>
              </div>
              <div>
                <span className="metric-label">Priority</span>
                <strong>
                  {caseState.priority ? <StatusBadge status={caseState.priority} /> : '—'}
                </strong>
              </div>
              <div>
                <span className="metric-label">Root cause</span>
                <strong>{formatCause(caseState.root_cause)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="simulator-picker-shell">
            <div className="simulator-picker-intro">
              <div>
                <strong>{caseId ? 'Switch receivable' : 'Choose a receivable'}</strong>
                <p>Search and select one case to model recovery strategies against.</p>
              </div>
              {cases.loading ? <span className="simulator-picker-status">Loading…</span> : null}
            </div>

            <label className="simulator-picker-search">
              <span className="sr-only">Search cases</span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="simulator-picker-search-icon">
                <path
                  fill="currentColor"
                  d="M8.5 3a5.5 5.5 0 0 1 4.38 8.74l3.19 3.19-1.06 1.06-3.19-3.19A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                />
              </svg>
              <input
                value={caseQuery}
                onChange={(e) => setCaseQuery(e.target.value)}
                placeholder="Search case ID, customer, or invoice"
                aria-label="Search cases"
              />
              {caseQuery ? (
                <button
                  type="button"
                  className="simulator-picker-clear"
                  onClick={() => setCaseQuery('')}
                  aria-label="Clear search"
                >
                  Clear
                </button>
              ) : null}
            </label>

            {cases.error && <p className="muted-note">{cases.error}</p>}

            <div className="simulator-picker-table" role="listbox" aria-label="Matching cases">
              <div className="simulator-picker-cols" aria-hidden="true">
                <span>Case</span>
                <span>Customer</span>
                <span>Cause</span>
                <span className="num">Outstanding</span>
              </div>

              {!cases.loading && caseOptions.length === 0 ? (
                <div className="simulator-picker-empty">
                  {debouncedQ ? 'No cases match that search.' : 'No cases available yet.'}
                </div>
              ) : null}

              {caseOptions.map((c) => {
                const selected = c.case_id === caseId
                return (
                  <button
                    key={c.case_id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`simulator-picker-row${selected ? ' is-selected' : ''}`}
                    onClick={() => selectCase(c.case_id)}
                  >
                    <span className="simulator-picker-case">
                      <strong>{c.case_id}</strong>
                      {c.priority_level ? <StatusBadge status={c.priority_level} /> : null}
                    </span>
                    <span className="simulator-picker-customer">{c.customer_name || '—'}</span>
                    <span className="simulator-picker-cause">{formatCause(c.root_cause)}</span>
                    <span className="simulator-picker-amt num">
                      {formatINRExact(c.outstanding_amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {caseLoading && <Loading label="Case state" />}
      {caseError && <ErrorState message={caseError} />}

      {caseState && (
        <>
          <Section title="Current case state">
            <p className="muted-note">
              Observed facts vs simulation assumptions are labeled. Simulation never changes this
              case.
            </p>
            <div className="metric-grid">
              <MetricCard
                label="Outstanding"
                value={formatINRExact(caseState.outstanding)}
                sub={caseState.field_sources.outstanding}
              />
              <MetricCard
                label="Days overdue"
                value={String(caseState.days_overdue)}
                sub={caseState.field_sources.days_overdue}
              />
              <MetricCard
                label="Priority"
                value={caseState.priority || '—'}
                sub="observed"
              />
              <MetricCard
                label="Payment intent"
                value={caseState.payment_intent || '—'}
                sub={caseState.field_sources.payment_intent}
              />
            </div>
            <dl className="kv simulator-kv">
              <div>
                <dt>Case / Invoice</dt>
                <dd>
                  {caseState.case_id}
                  {caseState.invoice_id ? ` · ${caseState.invoice_id}` : ''}
                </dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>
                  {caseState.customer_name || '—'}
                  {caseState.customer_id ? ` (${caseState.customer_id})` : ''}
                </dd>
              </div>
              <div>
                <dt>Root cause</dt>
                <dd>
                  {formatCause(caseState.root_cause)}{' '}
                  {sourceTag(caseState.field_sources.root_cause)}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {caseState.system_status} · {caseState.current_state}
                </dd>
              </div>
              <div>
                <dt>Constraints</dt>
                <dd>
                  {caseState.customer_opt_out ? (
                    <Badge tone="bad">Opt-out</Badge>
                  ) : (
                    <Badge tone="ok">Contact OK</Badge>
                  )}{' '}
                  {caseState.active_dispute ? (
                    <Badge tone="warn">Active dispute</Badge>
                  ) : (
                    <Badge tone="neutral">No dispute</Badge>
                  )}{' '}
                  {caseState.human_approval_required ? (
                    <Badge tone="info">Human approval</Badge>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Previous action</dt>
                <dd>{formatAction(caseState.previous_action)}</dd>
              </div>
            </dl>
          </Section>

          <Section
            title="Strategy builder"
            right={
              <div className="simulator-preset-row">
                {STRATEGY_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="simulator-preset-chip"
                    title={p.description}
                    onClick={() => applyPreset(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            }
          >
            <div className="simulator-scenario-meta">
              <label className="simulator-field">
                <span>Scenario name</span>
                <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
              </label>
              <label className="simulator-field grow">
                <span>Description</span>
                <input
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  placeholder="Optional notes"
                />
              </label>
            </div>

            <div className="simulator-budget">
              <span>
                Timeline:{' '}
                <strong>
                  day {lastStrategyDay}
                </strong>{' '}
                / {recoveryWindow}-day window
              </span>
              <span>
                Contacts:{' '}
                <strong>
                  {contactCount}
                </strong>{' '}
                / {maxContacts} max
              </span>
              {validation?.valid ? (
                <Badge tone="ok">Ready to simulate</Badge>
              ) : (
                <Badge tone="bad">Fix blocked steps</Badge>
              )}
            </div>

            <ol className="simulator-steps">
              {steps.map((step, index) => {
                const stepVal = validation?.steps[index]
                const day = stepDays[index] ?? 0
                const blocked = stepVal?.status === 'blocked'
                return (
                  <li
                    key={`${step.action}-${index}`}
                    className={`simulator-step${blocked ? ' is-blocked' : ''}${
                      stepVal?.status === 'requires_human_approval' ? ' needs-human' : ''
                    }`}
                  >
                    <div className="simulator-step-main">
                      <span className="simulator-step-day" title={`Runs on day ${day}`}>
                        Day {day}
                      </span>
                      <select
                        value={step.action}
                        onChange={(e) => updateStep(index, { action: e.target.value })}
                        aria-label={`Action ${index + 1}`}
                      >
                        {RECOVERY_ACTIONS.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                      <label className="simulator-delay">
                        Delay (days)
                        <IntInput
                          min={0}
                          max={60}
                          value={step.delay_days}
                          onChange={(n) => updateStep(index, { delay_days: n })}
                          aria-label={`Delay days for step ${index + 1}`}
                        />
                      </label>
                      <div className="simulator-step-actions">
                        <button type="button" onClick={() => moveStep(index, -1)} aria-label="Move up">
                          ↑
                        </button>
                        <button type="button" onClick={() => moveStep(index, 1)} aria-label="Move down">
                          ↓
                        </button>
                        <button type="button" onClick={() => removeStep(index)} aria-label="Remove">
                          ✕
                        </button>
                      </div>
                    </div>
                    {stepVal && stepVal.status !== 'allowed' && (
                      <div className={`simulator-constraint status-${stepVal.status}`}>
                        <Badge tone={stepVal.status === 'blocked' ? 'bad' : 'info'}>
                          {stepVal.status === 'blocked' ? 'Blocked' : 'Requires human approval'}
                        </Badge>
                        <span>{stepVal.reasons.join(' ')}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
            <button type="button" className="button-link" onClick={addStep}>
              + Add action
            </button>
            {validation && !validation.valid && (
              <div className="decision-banner bad" style={{ marginTop: '0.75rem' }}>
                <strong>Strategy invalid</strong>
                <p>
                  {validation.global_reasons.join(' ') ||
                    'One or more steps are blocked by policy constraints.'}
                </p>
              </div>
            )}
          </Section>

          <Section title="Simulation settings">
            <div className="simulator-settings">
              <label className="simulator-field">
                <span>
                  Payment probability <Badge tone="info">user-configured</Badge>
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={paymentProbability}
                  onChange={(e) => setPaymentProbability(Number(e.target.value))}
                />
                <em>{formatPct(paymentProbability)}</em>
              </label>
              <label className="simulator-field">
                <span>
                  Response probability <Badge tone="info">user-configured</Badge>
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={responseProbability}
                  onChange={(e) => setResponseProbability(Number(e.target.value))}
                />
                <em>{formatPct(responseProbability)}</em>
              </label>
              <label className="simulator-field">
                <span>
                  Partial-payment probability <Badge tone="info">user-configured</Badge>
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={partialProbability}
                  onChange={(e) => setPartialProbability(Number(e.target.value))}
                />
                <em>{formatPct(partialProbability)}</em>
              </label>
              <label className="simulator-field">
                <span>Recovery window (days)</span>
                <IntInput
                  min={1}
                  max={90}
                  value={recoveryWindow}
                  onChange={setRecoveryWindow}
                  aria-label="Recovery window days"
                />
              </label>
              <label className="simulator-field">
                <span>Max contacts</span>
                <IntInput
                  min={1}
                  max={10}
                  value={maxContacts}
                  onChange={setMaxContacts}
                  aria-label="Max contacts"
                />
              </label>
              <label className="simulator-field">
                <span>Simulation runs</span>
                <IntInput
                  min={100}
                  max={10000}
                  value={runs}
                  onChange={setRuns}
                  aria-label="Simulation runs"
                />
              </label>
              <label className="simulator-field">
                <span>Random seed</span>
                <IntInput
                  min={0}
                  value={seed}
                  onChange={setSeed}
                  aria-label="Random seed"
                />
              </label>
              <label className="simulator-field">
                <span>Optimization objective</span>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as OptimizationObjective)}
                >
                  {OBJECTIVES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="simulator-whatif">
              <span className="metric-label">What-if shortcuts</span>
              <div className="simulator-whatif-row">
                <button type="button" onClick={() => applyWhatIf('half')}>
                  Pay only ~50%
                </button>
                <button type="button" onClick={() => applyWhatIf('wait3')}>
                  Wait 3 days before follow-up
                </button>
                <button type="button" onClick={() => applyWhatIf('escalate')}>
                  Escalate immediately
                </button>
                <button type="button" onClick={() => applyWhatIf('link')}>
                  Payment link instead of reminder
                </button>
              </div>
            </div>

            <div className="simulator-run-row">
              <button
                type="button"
                className="primary"
                disabled={running || !validation?.valid}
                onClick={() => void runSim()}
              >
                {running ? 'Running simulation…' : 'Run simulation'}
              </button>
              <button type="button" onClick={() => setSeed(defaultSeed())}>
                New seed
              </button>
            </div>
            {runError && (
              <div className="decision-banner bad" style={{ marginTop: '0.75rem' }}>
                <strong>Simulation failed</strong>
                <p>{runError}</p>
              </div>
            )}
            {running && <Loading size="sm" label="Simulating" />}
          </Section>
        </>
      )}

      {latest && (
        <>
          <Section title="Simulation result">
            <p className="muted-note">{latest.disclaimer}</p>
            <div className="metric-grid">
              <MetricCard
                label="Expected recovery"
                value={formatINRExact(latest.expected_recovery)}
                sub={`Confidence ${latest.confidence}`}
              />
              <MetricCard
                label="Expected net recovery"
                value={formatINRExact(latest.expected_net_recovery)}
                sub={`Cost ${formatINRExact(latest.expected_cost)}`}
              />
              <MetricCard
                label="Recovery rate"
                value={formatPct(latest.expected_recovery_rate)}
                sub={`${formatPct(latest.full_recovery_probability)} full`}
              />
              <MetricCard
                label="Expected time"
                value={`${latest.expected_recovery_days.toFixed(1)} days`}
                sub={`${latest.earliest_recovery_days.toFixed(1)}–${latest.latest_recovery_days.toFixed(1)}`}
              />
            </div>

            <div className="simulator-outcome-grid">
              {latest.outcome_bars.map((bar) => (
                <div key={bar.label} className="simulator-outcome-row">
                  <div className="simulator-outcome-label">
                    <span>{bar.label}</span>
                    <strong>{formatPct(bar.probability)}</strong>
                  </div>
                  <div className="simulator-outcome-track">
                    <div
                      className="simulator-outcome-fill"
                      style={{ width: `${Math.max(2, bar.probability * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="simulator-meta-row">
              <Badge tone={riskTone(latest.risk)}>Risk {latest.risk}</Badge>
              <Badge tone="info">Confidence {latest.confidence}</Badge>
              <span className="muted-note">
                {latest.simulation_id} · seed {latest.parameters.seed} ·{' '}
                {latest.parameters.simulation_runs} runs · {latest.simulator_version}
              </span>
            </div>

            <div className="grid-2" style={{ marginTop: '1rem' }}>
              <div>
                <h3 className="simulator-subhead">Why this result?</h3>
                <pre className="simulator-breakdown">{`+ ${formatINRExact(latest.breakdown.expected_recovery)} expected recovery
− ${formatINRExact(latest.breakdown.action_cost)} action cost
− ${formatINRExact(latest.breakdown.relationship_penalty)} relationship penalty
────────────────────────
= ${formatINRExact(latest.breakdown.expected_net_recovery)} expected net recovery`}</pre>
                <ul className="simulator-reason-list">
                  {latest.risk_reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {latest.confidence_reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {latest.historical_evidence && (
                  <p className="muted-note">
                    Historical support for {formatAction(latest.historical_evidence.action)}:{' '}
                    {latest.historical_evidence.historical_cases} cases,{' '}
                    {formatPct(latest.historical_evidence.observed_success_rate)} observed success (
                    {latest.historical_evidence.evidence_strength}). Basis:{' '}
                    {latest.historical_evidence.basis}.
                  </p>
                )}
              </div>
              <div>
                <h3 className="simulator-subhead">Strategy timeline</h3>
                <ol className="simulator-timeline">
                  {latest.timeline.map((node) => (
                    <li key={`${node.day}-${node.action}`}>
                      <strong>
                        Day {node.day} — {formatAction(node.action)}
                      </strong>
                      <ul>
                        {node.branches.map((b) => (
                          <li key={b.outcome}>
                            {b.outcome} → {b.next}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>

          <Section title="Scenario history & comparison">
            <p className="muted-note">
              Saved locally on this browser. Select two or more scenarios to compare.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Compare</th>
                    <th>Scenario</th>
                    <th>Created</th>
                    <th className="num">Expected recovery</th>
                    <th className="num">Net</th>
                    <th className="num">Full %</th>
                    <th>Risk</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.simulation_id}
                      className={h.simulation_id === latest.simulation_id ? 'row-recommended' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={compareIds.includes(h.simulation_id)}
                          onChange={(e) => {
                            setCompareIds((ids) =>
                              e.target.checked
                                ? [...ids, h.simulation_id].slice(0, 4)
                                : ids.filter((id) => id !== h.simulation_id),
                            )
                          }}
                          aria-label={`Compare ${h.scenario_name}`}
                        />
                      </td>
                      <td>
                        <strong>{h.scenario_name}</strong>
                        <div className="muted-note">{h.simulation_id}</div>
                      </td>
                      <td>{formatTs(h.created_at)}</td>
                      <td className="num">{formatINRExact(h.result.expected_recovery)}</td>
                      <td className="num">{formatINRExact(h.result.expected_net_recovery)}</td>
                      <td className="num">{formatPct(h.result.full_recovery_probability)}</td>
                      <td>
                        <Badge tone={riskTone(h.result.risk)}>{h.result.risk}</Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button-link"
                          onClick={() => {
                            setLatest(h.result)
                            setSteps(h.result.strategy.map((s) => ({ ...s })))
                            setScenarioName(h.scenario_name)
                            setSeed(h.result.parameters.seed)
                            setRuns(h.result.parameters.simulation_runs)
                            setPaymentProbability(h.result.parameters.payment_probability)
                            setResponseProbability(h.result.parameters.response_probability)
                            setPartialProbability(h.result.parameters.partial_payment_probability)
                            setRecoveryWindow(h.result.parameters.recovery_window_days)
                            setMaxContacts(h.result.parameters.max_contacts)
                          }}
                        >
                          Reopen
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!history.length && (
                    <tr>
                      <td colSpan={8}>No saved simulations yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {comparison && comparison.rows.length >= 2 && (
              <div className="simulator-compare" style={{ marginTop: '1rem' }}>
                <h3 className="simulator-subhead">Strategy comparison</h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {comparison.rows.map((r) => (
                          <th key={r.simulation_id}>
                            {r.scenario_name}
                            {r.recommended ? ' ★' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['Expected recovery', (r: SimulationResult) => formatINRExact(r.expected_recovery)],
                          ['Recovery rate', (r: SimulationResult) => formatPct(r.expected_recovery_rate)],
                          ['Full recovery', (r: SimulationResult) => formatPct(r.full_recovery_probability)],
                          ['Partial recovery', (r: SimulationResult) => formatPct(r.partial_recovery_probability)],
                          ['No recovery', (r: SimulationResult) => formatPct(r.no_recovery_probability)],
                          ['Expected cost', (r: SimulationResult) => formatINRExact(r.expected_cost)],
                          ['Expected net', (r: SimulationResult) => formatINRExact(r.expected_net_recovery)],
                          [
                            'Expected time',
                            (r: SimulationResult) => `${r.expected_recovery_days.toFixed(1)} days`,
                          ],
                          ['Risk', (r: SimulationResult) => r.risk],
                        ] as const
                      ).map(([label, fmt]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          {comparison.rows.map((r) => (
                            <td key={r.simulation_id} className="num">
                              {fmt(r)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {comparison.recommendation && (
                  <div className="decision-banner ok" style={{ marginTop: '0.75rem' }}>
                    <strong>Recommended strategy</strong>
                    <p>{comparison.recommendation.reason}</p>
                    <pre className="simulator-breakdown">{`+ ${formatINRExact(comparison.recommendation.winner.breakdown.expected_recovery)} expected recovery
− ${formatINRExact(comparison.recommendation.winner.breakdown.action_cost)} action cost
− ${formatINRExact(comparison.recommendation.winner.breakdown.relationship_penalty)} relationship penalty
────────────────────────
= ${formatINRExact(comparison.recommendation.winner.breakdown.expected_net_recovery)} expected net recovery`}</pre>
                  </div>
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
