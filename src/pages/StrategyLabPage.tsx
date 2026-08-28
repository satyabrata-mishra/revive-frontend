import { useEffect, useMemo, useRef, useState } from 'react'
import {
  strategyLabApi,
  type ExperimentResult,
  type PopulationFilters,
  type StrategyKnobs,
  type StrategyPreset,
} from '../api/strategyLab'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IntInput } from '../components/IntInput'
import { Badge, ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatINR, formatINRExact, formatPct } from '../utils/format'

const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4']
const CAUSE_OPTIONS = [
  'BILLING_MISMATCH',
  'PO_MISSING',
  'ADMIN_BLOCKER',
  'CASH_FLOW_DELAY',
  'SLOW_PAYER',
  'DISPUTE',
  'PROMISE_BREACH',
]

const DEFAULT_POP: PopulationFilters = {
  priorities: ['P1', 'P2'],
  root_causes: [],
  min_outstanding: 0,
  exclude_opt_out: true,
  exclude_dispute: false,
}

/** Matches backend "high_value_first" so proposed ≠ current on first run. */
const HIGH_VALUE_KNOBS: StrategyKnobs = {
  human_escalation_threshold: 500_000,
  recovery_window_days: 14,
  max_contacts: 3,
  automation_bias: 0.4,
  prefer_payment_link: false,
  billing_fix_first: true,
}

const CURRENT_KNOBS: StrategyKnobs = {
  human_escalation_threshold: 1_000_000,
  recovery_window_days: 14,
  max_contacts: 3,
  automation_bias: 0.5,
  prefer_payment_link: false,
  billing_fix_first: true,
}

export function StrategyLabPage() {
  const baseline = useAsync(() => strategyLabApi.baseline(), [])
  const presetsReq = useAsync(() => strategyLabApi.presets(), [])

  const [population, setPopulation] = useState<PopulationFilters>(DEFAULT_POP)
  const [knobs, setKnobs] = useState<StrategyKnobs>(HIGH_VALUE_KNOBS)
  const [strategyName, setStrategyName] = useState('High Value First')
  const [activePreset, setActivePreset] = useState<string | null>('high_value_first')
  const [presetsApplied, setPresetsApplied] = useState(false)

  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof strategyLabApi.previewPopulation>
  > | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [baselineExp, setBaselineExp] = useState<ExperimentResult | null>(null)
  const [proposedExp, setProposedExp] = useState<ExperimentResult | null>(null)
  const [compare, setCompare] = useState<Awaited<
    ReturnType<typeof strategyLabApi.compare>
  > | null>(null)

  const [proposedStrategyId, setProposedStrategyId] = useState<string | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approveMsg, setApproveMsg] = useState<string | null>(null)
  /** After approve, later runs compare Proposed against this baseline (not the static Current preset). */
  const [approvedBaseline, setApprovedBaseline] = useState<{
    strategy_id: string
    name: string
    knobs: StrategyKnobs
  } | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const presets: StrategyPreset[] = presetsReq.data?.items || []

  // Sync knobs from API preset once loaded (keeps UI label and knobs aligned).
  useEffect(() => {
    if (presetsApplied || !presets.length) return
    const preset = presets.find((p) => p.preset_id === 'high_value_first') || presets[0]
    if (!preset) return
    setActivePreset(preset.preset_id)
    setKnobs({ ...preset.knobs })
    setStrategyName(preset.name)
    setPresetsApplied(true)
  }, [presets, presetsApplied])

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    strategyLabApi
      .previewPopulation(population)
      .then((p) => {
        if (!cancelled) setPreview(p)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [population])

  function applyPreset(preset: StrategyPreset) {
    setActivePreset(preset.preset_id)
    setKnobs({ ...preset.knobs })
    setStrategyName(preset.name)
  }

  function togglePriority(p: string) {
    setPopulation((prev) => {
      const has = prev.priorities.includes(p)
      const priorities = has ? prev.priorities.filter((x) => x !== p) : [...prev.priorities, p]
      return { ...prev, priorities: priorities.length ? priorities : ['P1'] }
    })
    setActivePreset(null)
  }

  function toggleCause(c: string) {
    setPopulation((prev) => {
      const has = prev.root_causes.includes(c)
      const root_causes = has ? prev.root_causes.filter((x) => x !== c) : [...prev.root_causes, c]
      return { ...prev, root_causes }
    })
    setActivePreset(null)
  }

  function knobsEqual(a: StrategyKnobs, b: StrategyKnobs) {
    return (
      a.human_escalation_threshold === b.human_escalation_threshold &&
      a.recovery_window_days === b.recovery_window_days &&
      a.max_contacts === b.max_contacts &&
      a.automation_bias === b.automation_bias &&
      a.prefer_payment_link === b.prefer_payment_link &&
      a.billing_fix_first === b.billing_fix_first
    )
  }

  async function runSimulation() {
    setRunning(true)
    setRunError(null)
    setApproveMsg(null)
    try {
      const seed = 42
      const catalogCurrent =
        presets.find((p) => p.preset_id === 'current')?.knobs || CURRENT_KNOBS
      const baselineKnobs = approvedBaseline?.knobs || catalogCurrent
      const baselineName = approvedBaseline?.name || 'Current Strategy'

      if (knobsEqual(baselineKnobs, knobs)) {
        setRunError(
          approvedBaseline
            ? `Proposed knobs match your approved baseline (“${approvedBaseline.name}”). Change a slider or pick another preset to compare.`
            : 'Proposed knobs match Current Strategy — change a slider or pick High Value First / Aggressive before running.',
        )
        return
      }

      const current = await strategyLabApi.createStrategy({
        name: baselineName,
        population,
        knobs: baselineKnobs,
      })
      const proposed = await strategyLabApi.createStrategy({
        name: strategyName || 'Proposed strategy',
        description: activePreset ? `Preset: ${activePreset}` : 'Custom knobs',
        population,
        knobs,
      })
      setProposedStrategyId(proposed.strategy_id)

      const expA = await strategyLabApi.runExperiment({
        strategy_id: current.strategy_id,
        seed,
        label: baselineName,
      })
      const expB = await strategyLabApi.runExperiment({
        strategy_id: proposed.strategy_id,
        seed,
        label: strategyName || 'Proposed',
      })
      setBaselineExp(expA)
      setProposedExp(expB)
      const cmp = await strategyLabApi.compare(
        [expA.experiment_id, expB.experiment_id],
        'max_net',
      )
      setCompare(cmp)

      // Keep previous results visible until these land; then scroll to compare.
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  async function confirmApprove() {
    if (!proposedStrategyId || !proposedExp) return
    setApproving(true)
    try {
      const res = await strategyLabApi.approve(proposedStrategyId)
      setApproveMsg(res.message)
      setApproveOpen(false)
      setApprovedBaseline({
        strategy_id: proposedStrategyId,
        name: proposedExp.label || strategyName || 'Approved strategy',
        knobs: { ...knobs },
      })
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : String(e))
    } finally {
      setApproving(false)
    }
  }

  const baselineColumnLabel = approvedBaseline?.name || 'Current'
  const proposedColumnLabel = proposedExp?.label || strategyName || 'Proposed'

  const delta = useMemo(() => {
    if (!baselineExp || !proposedExp) return null
    const a = baselineExp.metrics
    const b = proposedExp.metrics
    return {
      recovery: b.expected_recovery - a.expected_recovery,
      net: b.expected_net_recovery - a.expected_net_recovery,
      cost: b.expected_cost - a.expected_cost,
      humans: b.human_escalations - a.human_escalations,
      contacts: b.contact_volume - a.contact_volume,
    }
  }, [baselineExp, proposedExp])

  if (baseline.loading) return <Loading label="Strategy Lab" />
  if (baseline.error) return <ErrorState message={baseline.error} />

  const b = baseline.data

  return (
    <div className="strategy-lab-page">
      <div className="page-head">
        <div>
          <h1>Recovery Strategy Lab</h1>
          <p>
            What recovery strategy should I use across my portfolio? Design → simulate →
            compare → approve — never silent execution.
          </p>
        </div>
      </div>

      <div className="simulator-banner" role="status">
        SIMULATED — NO ACTION WILL BE EXECUTED
      </div>

      {b && (
        <Section title="Portfolio baseline">
          <div className="metric-grid">
            <MetricCard label="Open cases" value={String(b.open_cases)} />
            <MetricCard label="Revenue at risk" value={formatINR(b.revenue_at_risk)} />
            <MetricCard label="Expected recovery" value={formatINR(b.expected_recovery)} sub="estimate" />
            <MetricCard
              label="Expected net"
              value={formatINR(b.expected_net_recovery)}
              sub={`${b.human_escalations} human escalations`}
            />
          </div>
          <p className="muted-note">{b.disclaimer}</p>
        </Section>
      )}

      {approvedBaseline && (
        <div className="decision-banner ok" style={{ marginBottom: '0.85rem' }}>
          <strong>Approved baseline: {approvedBaseline.name}</strong>
          <p>
            The next simulation compares your Proposed knobs against this approved strategy (not
            the original Current preset). Pick a different preset or change sliders, then run
            again to see a new comparison.
          </p>
        </div>
      )}

      <div className="strategy-lab-grid">
        <Section title="Population">
          <p className="muted-note">Which receivables should this strategy apply to?</p>
          <div className="strategy-lab-chips">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`strategy-lab-chip${population.priorities.includes(p) ? ' is-on' : ''}`}
                onClick={() => togglePriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="strategy-lab-chips" style={{ marginTop: '0.55rem' }}>
            {CAUSE_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={`strategy-lab-chip${population.root_causes.includes(c) ? ' is-on' : ''}`}
                onClick={() => toggleCause(c)}
              >
                {c.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <label className="simulator-field" style={{ marginTop: '0.85rem' }}>
            <span>Minimum outstanding (₹)</span>
            <IntInput
              min={0}
              max={100_000_000}
              value={population.min_outstanding}
              aria-label="Minimum outstanding"
              onChange={(n) => {
                setPopulation((prev) => ({ ...prev, min_outstanding: n }))
                setActivePreset(null)
              }}
            />
          </label>
          <div className="strategy-lab-preview">
            {previewLoading && <Loading size="sm" label="Population" />}
            {preview && !previewLoading && (
              <>
                <strong>
                  {preview.matching_cases} / {preview.total_open_cases} cases
                </strong>
                <span>{formatINRExact(preview.revenue_at_risk)} at risk</span>
                <span>Avg {formatINR(preview.average_outstanding)}</span>
              </>
            )}
          </div>
        </Section>

        <Section title="Strategy knobs">
          <div className="strategy-lab-presets">
            {presets.map((p) => (
              <button
                key={p.preset_id}
                type="button"
                className={`simulator-preset-chip${activePreset === p.preset_id ? ' is-active' : ''}`}
                title={p.description}
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>

          <label className="simulator-field" style={{ marginTop: '0.75rem' }}>
            <span>Strategy name</span>
            <input
              value={strategyName}
              onChange={(e) => {
                setStrategyName(e.target.value)
                setActivePreset(null)
              }}
            />
          </label>

          <label className="simulator-field">
            <span>
              Human escalation threshold{' '}
              <em>{formatINR(knobs.human_escalation_threshold)}</em>
            </span>
            <input
              type="range"
              min={100_000}
              max={2_500_000}
              step={50_000}
              value={knobs.human_escalation_threshold}
              onChange={(e) => {
                setKnobs((k) => ({
                  ...k,
                  human_escalation_threshold: Number(e.target.value),
                }))
                setActivePreset(null)
              }}
            />
          </label>

          <label className="simulator-field">
            <span>
              Recovery window <em>{knobs.recovery_window_days} days</em>
            </span>
            <input
              type="range"
              min={3}
              max={30}
              value={knobs.recovery_window_days}
              onChange={(e) => {
                setKnobs((k) => ({ ...k, recovery_window_days: Number(e.target.value) }))
                setActivePreset(null)
              }}
            />
          </label>

          <label className="simulator-field">
            <span>
              Max contacts <em>{knobs.max_contacts}</em>
            </span>
            <input
              type="range"
              min={1}
              max={8}
              value={knobs.max_contacts}
              onChange={(e) => {
                setKnobs((k) => ({ ...k, max_contacts: Number(e.target.value) }))
                setActivePreset(null)
              }}
            />
          </label>

          <label className="simulator-field">
            <span>
              Automation bias{' '}
              <em>{knobs.automation_bias < 0.4 ? 'Conservative' : knobs.automation_bias > 0.7 ? 'Aggressive' : 'Balanced'}</em>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={knobs.automation_bias}
              onChange={(e) => {
                setKnobs((k) => ({ ...k, automation_bias: Number(e.target.value) }))
                setActivePreset(null)
              }}
            />
          </label>

          <label className="strategy-lab-check">
            <input
              type="checkbox"
              checked={knobs.prefer_payment_link}
              onChange={(e) => {
                setKnobs((k) => ({ ...k, prefer_payment_link: e.target.checked }))
                setActivePreset(null)
              }}
            />
            Prefer payment links for routine overdue
          </label>
          <label className="strategy-lab-check">
            <input
              type="checkbox"
              checked={knobs.billing_fix_first}
              onChange={(e) => {
                setKnobs((k) => ({ ...k, billing_fix_first: e.target.checked }))
                setActivePreset(null)
              }}
            />
            Fix billing / PO issues first
          </label>

          <div className="simulator-run-row" style={{ marginTop: '1rem' }}>
            <button type="button" className="primary" disabled={running} onClick={() => void runSimulation()}>
              {running ? 'Running simulation…' : 'Run simulation'}
            </button>
          </div>
          {runError && (
            <div className="decision-banner bad" style={{ marginTop: '0.75rem' }}>
              <strong>Simulation failed</strong>
              <p>{runError}</p>
            </div>
          )}
        </Section>
      </div>

      <div ref={resultsRef}>
      {baselineExp && proposedExp && (
        <Section title="Compare strategies">
          <p className="muted-note">
            {proposedExp.disclaimer} Comparing <strong>{proposedColumnLabel}</strong> vs{' '}
            <strong>{baselineColumnLabel}</strong>
            {approvedBaseline ? ' (approved baseline)' : ''}.
          </p>

          {delta && (
            <div className="metric-grid">
              <MetricCard
                label="Recovery impact"
                value={`${delta.recovery >= 0 ? '+' : ''}${formatINR(delta.recovery)}`}
                sub={`vs ${baselineColumnLabel}`}
              />
              <MetricCard
                label="Net recovery impact"
                value={`${delta.net >= 0 ? '+' : ''}${formatINR(delta.net)}`}
                sub={`vs ${baselineColumnLabel}`}
              />
              <MetricCard
                label="Human workload"
                value={`${delta.humans >= 0 ? '+' : ''}${delta.humans}`}
                sub="escalations"
              />
              <MetricCard
                label="Contact volume"
                value={`${delta.contacts >= 0 ? '+' : ''}${delta.contacts}`}
                sub="customer contacts"
              />
            </div>
          )}

          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="num">{baselineColumnLabel}</th>
                  <th className="num">{proposedColumnLabel}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Cases', (m) => String(m.cases)],
                    ['Revenue at risk', (m) => formatINRExact(m.revenue_at_risk)],
                    ['Expected recovery', (m) => formatINRExact(m.expected_recovery)],
                    ['Expected cost', (m) => formatINRExact(m.expected_cost)],
                    ['Expected net', (m) => formatINRExact(m.expected_net_recovery)],
                    ['Recovery rate', (m) => formatPct(m.recovery_rate)],
                    ['Human escalations', (m) => String(m.human_escalations)],
                    ['Contacts', (m) => String(m.contact_volume)],
                    ['Automation rate', (m) => formatPct(m.automation_rate)],
                  ] as [string, (m: ExperimentResult['metrics']) => string][]
                ).map(([label, fmt]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="num">{fmt(baselineExp.metrics)}</td>
                    <td className="num">{fmt(proposedExp.metrics)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {compare && (
            <div className="decision-banner ok" style={{ marginTop: '0.9rem' }}>
              <strong>Recommendation</strong>
              <p>{compare.recommendation}</p>
              <ul className="strategy-lab-tradeoffs">
                {compare.tradeoffs.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div>
              <h3 className="simulator-subhead">Why this result?</h3>
              <p>{proposedExp.explanation}</p>
              <ul className="simulator-reason-list">
                {proposedExp.drivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="simulator-subhead">Proposed action mix</h3>
              <ul className="strategy-lab-mix">
                {Object.entries(proposedExp.action_mix)
                  .sort((a, b) => b[1] - a[1])
                  .map(([action, count]) => (
                    <li key={action}>
                      <span>{action.replace(/_/g, ' ')}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="simulator-run-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="primary"
              disabled={!proposedStrategyId}
              onClick={() => setApproveOpen(true)}
            >
              Approve strategy
            </button>
            {approveMsg && <Badge tone="ok">{approveMsg}</Badge>}
          </div>
        </Section>
      )}
      </div>

      <ConfirmDialog
        open={approveOpen}
        title="Approve strategy?"
        message="This stores the strategy as an approved configuration only. It will not send emails, payment links, or change invoice status. Production Decide → Policy → Execute remains authoritative."
        confirmLabel="Approve (no execution)"
        busy={approving}
        onConfirm={() => void confirmApprove()}
        onCancel={() => setApproveOpen(false)}
      />
    </div>
  )
}
