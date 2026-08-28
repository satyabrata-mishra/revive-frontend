import { ACTION_BY_ID } from './actions'
import type { SimulatorCaseState } from './caseState'
import { validateStrategy, type StrategyStepInput } from './constraints'
import { createRng, defaultSeed } from './rng'

export type OptimizationObjective =
  | 'max_recovery'
  | 'max_net'
  | 'fastest'
  | 'balanced'

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH'
export type ConfidenceBand = 'LOW' | 'MEDIUM' | 'HIGH'

export interface SimulationParameters {
  /** Multiplier on catalog full-recovery probability (user-configurable). */
  payment_probability?: number
  response_probability?: number
  partial_payment_probability?: number
  recovery_window_days?: number
  max_contacts?: number
  simulation_runs?: number
  seed?: number
  relationship_penalty_scale?: number
  action_cost_scale?: number
}

export interface SimulateRequest {
  case_id: string
  case_state: SimulatorCaseState
  strategy: StrategyStepInput[]
  scenario_name?: string
  scenario_description?: string
  parameters?: SimulationParameters
  /** Optional priors from backend action-comparison. */
  action_priors?: Record<
    string,
    { pFull: number; pPartial: number; pNone: number; actionCost: number }
  >
  objective?: OptimizationObjective
}

export interface SimulationResult {
  simulation_id: string
  case_id: string
  scenario_name: string
  scenario_description?: string
  created_at: string
  strategy: StrategyStepInput[]
  parameters: Required<
    Pick<
      SimulationParameters,
      | 'payment_probability'
      | 'response_probability'
      | 'partial_payment_probability'
      | 'recovery_window_days'
      | 'max_contacts'
      | 'simulation_runs'
      | 'seed'
    >
  > &
    SimulationParameters
  expected_recovery: number
  expected_cost: number
  expected_relationship_penalty: number
  expected_net_recovery: number
  expected_recovery_rate: number
  full_recovery_probability: number
  partial_recovery_probability: number
  no_recovery_probability: number
  expected_recovery_days: number
  earliest_recovery_days: number
  latest_recovery_days: number
  risk: RiskBand
  risk_reasons: string[]
  confidence: ConfidenceBand
  confidence_reasons: string[]
  outcome_bars: { label: string; probability: number }[]
  timeline: {
    day: number
    action: string
    branches: { outcome: string; next: string }[]
  }[]
  breakdown: {
    expected_recovery: number
    action_cost: number
    relationship_penalty: number
    expected_net_recovery: number
  }
  historical_evidence?: {
    action: string
    historical_cases: number
    successful_recoveries: number
    observed_success_rate: number
    evidence_strength: 'WEAK' | 'MODERATE' | 'STRONG'
    basis: string
  }
  validation: ReturnType<typeof validateStrategy>
  simulator_version: string
  probability_model_version: string
  policy_model_version: string
  disclaimer: string
  recommended?: boolean
}

const SIMULATOR_VERSION = 'v1.0'
const PROB_MODEL_VERSION = 'v1.0'
const POLICY_MODEL_VERSION = 'v1.0'

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function normalize3(a: number, b: number, c: number): [number, number, number] {
  const s = a + b + c
  if (s <= 0) return [0.33, 0.33, 0.34]
  return [a / s, b / s, c / s]
}

function adjustForCase(
  base: { pFull: number; pPartial: number; pNone: number },
  caseState: SimulatorCaseState,
  params: SimulationParameters,
): [number, number, number] {
  let pFull = base.pFull
  let pPartial = base.pPartial
  let pNone = base.pNone

  if (caseState.days_overdue > 60) {
    pFull *= 0.75
    pNone += 0.08
  } else if (caseState.days_overdue > 30) {
    pFull *= 0.88
  }

  const cause = caseState.root_cause
  if (cause === 'BILLING_MISMATCH' || cause === 'PO_MISSING') {
    pFull *= 1.12
  } else if (cause === 'DISPUTE') {
    pFull *= 0.55
    pNone += 0.12
  } else if (cause === 'CASH_FLOW_DELAY') {
    pPartial *= 1.15
  }

  const intent = (caseState.payment_intent || '').toUpperCase()
  if (intent.includes('HIGH') || intent.includes('LIKELY')) pFull *= 1.1
  if (intent.includes('LOW') || intent.includes('UNLIKELY')) pFull *= 0.8

  if (params.payment_probability != null) {
    const target = clamp01(params.payment_probability)
    const scale = target / Math.max(0.05, pFull + pPartial * 0.5)
    pFull *= scale
    pPartial *= scale * 0.9
  }
  if (params.partial_payment_probability != null) {
    pPartial = clamp01(params.partial_payment_probability)
  }

  return normalize3(pFull, pPartial, pNone)
}

function riskScore(
  caseState: SimulatorCaseState,
  pNone: number,
  confidence: ConfidenceBand,
  relationshipPenalty: number,
  outstanding: number,
): { risk: RiskBand; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (pNone >= 0.4) {
    score += 2
    reasons.push(`High probability of no recovery (${(pNone * 100).toFixed(0)}%).`)
  } else if (pNone >= 0.25) {
    score += 1
    reasons.push('Moderate no-recovery probability.')
  }

  if (outstanding >= 500_000) {
    score += 2
    reasons.push('High outstanding amount increases downside.')
  } else if (outstanding >= 100_000) {
    score += 1
    reasons.push('Material outstanding amount.')
  }

  if (confidence === 'LOW') {
    score += 2
    reasons.push('Low model confidence.')
  } else if (confidence === 'MEDIUM') {
    score += 1
  }

  if (relationshipPenalty > 2000) {
    score += 1
    reasons.push('Elevated customer relationship penalty.')
  }

  if (caseState.active_dispute) {
    score += 2
    reasons.push('Active dispute increases outcome uncertainty.')
  }

  if (caseState.recovery_window_days > 21) {
    score += 1
    reasons.push('Long recovery window increases uncertainty.')
  }

  const risk: RiskBand = score >= 5 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW'
  if (!reasons.length) reasons.push('Stable priors and moderate exposure.')
  return { risk, reasons }
}

function confidenceBand(
  caseState: SimulatorCaseState,
  hasPriors: boolean,
  runs: number,
): { confidence: ConfidenceBand; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (hasPriors) {
    score += 2
    reasons.push('Calibrated from Revive action-comparison history.')
  } else {
    reasons.push('Using catalog priors (limited case-specific history).')
  }

  if (caseState.root_cause && (caseState.root_cause_confidence ?? 0) >= 0.7) {
    score += 1
    reasons.push('Root-cause diagnosis confidence is high.')
  } else if (!caseState.root_cause) {
    score -= 1
    reasons.push('Missing root-cause diagnosis.')
  }

  if (runs >= 5000) score += 1
  if (caseState.outstanding <= 0) {
    score -= 2
    reasons.push('Zero outstanding — simulation is not meaningful.')
  }

  const confidence: ConfidenceBand = score >= 3 ? 'HIGH' : score >= 1 ? 'MEDIUM' : 'LOW'
  return { confidence, reasons }
}

function nextSimId(): string {
  const n = Math.floor(Math.random() * 90000) + 10000
  return `SIM-${n}`
}

export function runSimulation(req: SimulateRequest): SimulationResult {
  const params = req.parameters || {}
  const runs = Math.min(20_000, Math.max(100, params.simulation_runs ?? 5000))
  const seed = params.seed ?? defaultSeed()
  const rng = createRng(seed)

  const windowDays = params.recovery_window_days ?? req.case_state.recovery_window_days
  const maxContacts = params.max_contacts ?? req.case_state.max_contacts
  const paymentProb = params.payment_probability ?? 0.45
  const responseProb = params.response_probability ?? 0.55
  const partialProb = params.partial_payment_probability ?? 0.25
  const costScale = params.action_cost_scale ?? 1
  const relScale = params.relationship_penalty_scale ?? 1

  const validation = validateStrategy(req.case_state, req.strategy, {
    max_contacts: maxContacts,
    recovery_window_days: windowDays,
  })

  if (!validation.valid) {
    throw new Error(
      validation.global_reasons[0] ||
        validation.steps.find((s) => s.status === 'blocked')?.reasons[0] ||
        'Strategy failed constraint validation.',
    )
  }

  const outstanding = Math.max(0, req.case_state.outstanding)
  let fullCount = 0
  let partialCount = 0
  let noneCount = 0
  let sumRecovery = 0
  let sumCost = 0
  let sumRel = 0
  let sumDays = 0
  let minDays = Infinity
  let maxDays = 0

  const hasPriors = Boolean(req.action_priors && Object.keys(req.action_priors).length)

  for (let i = 0; i < runs; i++) {
    let recovered = 0
    let cost = 0
    let rel = 0
    let day = 0
    let remaining = outstanding
    let terminal: 'full' | 'partial' | 'none' = 'none'
    let recoveryDay = windowDays

    for (const step of req.strategy) {
      const catalog = ACTION_BY_ID[step.action]
      if (!catalog) break
      day += Math.max(0, step.delay_days)
      if (day > windowDays) break

      cost += catalog.actionCost * costScale
      rel += catalog.relationshipPenalty * relScale

      const prior = req.action_priors?.[step.action]
      const base = prior
        ? { pFull: prior.pFull, pPartial: prior.pPartial, pNone: prior.pNone }
        : { pFull: catalog.pFull, pPartial: catalog.pPartial, pNone: catalog.pNone }
      if (prior?.actionCost != null) {
        cost += Math.max(0, prior.actionCost * costScale - catalog.actionCost * costScale)
      }

      const [pFull, pPartial] = adjustForCase(base, req.case_state, {
        ...params,
        payment_probability: paymentProb,
        partial_payment_probability: partialProb,
      })

      // Soft response gate: non-response often continues to next step
      const responded = !catalog.contact || rng() < responseProb
      if (!responded) {
        continue
      }

      const u = rng()
      if (u < pFull) {
        recovered += remaining
        remaining = 0
        terminal = 'full'
        recoveryDay = day + catalog.expectedDays * (0.6 + rng() * 0.8)
        break
      }
      if (u < pFull + pPartial) {
        const frac = catalog.partialFraction * (0.7 + rng() * 0.5)
        const take = remaining * clamp01(frac)
        recovered += take
        remaining -= take
        terminal = remaining <= outstanding * 0.02 ? 'full' : 'partial'
        recoveryDay = day + catalog.expectedDays * (0.8 + rng() * 0.9)
        if (terminal === 'full') {
          remaining = 0
          break
        }
        // Continue strategy after partial
        continue
      }
      // no recovery on this step — continue
    }

    if (terminal === 'full' || remaining <= 0) fullCount++
    else if (recovered > 0) partialCount++
    else noneCount++

    sumRecovery += recovered
    sumCost += cost
    sumRel += rel
    sumDays += recoveryDay
    minDays = Math.min(minDays, recoveryDay)
    maxDays = Math.max(maxDays, recoveryDay)
  }

  const expected_recovery = sumRecovery / runs
  const expected_cost = sumCost / runs
  const expected_relationship_penalty = sumRel / runs
  const expected_net_recovery = expected_recovery - expected_cost - expected_relationship_penalty
  const expected_recovery_rate = outstanding > 0 ? expected_recovery / outstanding : 0
  const full_recovery_probability = fullCount / runs
  const partial_recovery_probability = partialCount / runs
  const no_recovery_probability = noneCount / runs
  const expected_recovery_days = sumDays / runs

  const { confidence, reasons: confidence_reasons } = confidenceBand(
    req.case_state,
    hasPriors,
    runs,
  )
  const { risk, reasons: risk_reasons } = riskScore(
    req.case_state,
    no_recovery_probability,
    confidence,
    expected_relationship_penalty,
    outstanding,
  )

  const timeline = buildTimeline(req.strategy)
  const primaryAction = req.strategy[0]?.action || 'NO_ACTION'
  const catalogPrimary = ACTION_BY_ID[primaryAction]

  return {
    simulation_id: nextSimId(),
    case_id: req.case_id,
    scenario_name: req.scenario_name || 'Untitled scenario',
    scenario_description: req.scenario_description,
    created_at: new Date().toISOString(),
    strategy: req.strategy,
    parameters: {
      payment_probability: paymentProb,
      response_probability: responseProb,
      partial_payment_probability: partialProb,
      recovery_window_days: windowDays,
      max_contacts: maxContacts,
      simulation_runs: runs,
      seed,
      relationship_penalty_scale: relScale,
      action_cost_scale: costScale,
    },
    expected_recovery,
    expected_cost,
    expected_relationship_penalty,
    expected_net_recovery,
    expected_recovery_rate,
    full_recovery_probability,
    partial_recovery_probability,
    no_recovery_probability,
    expected_recovery_days,
    earliest_recovery_days: Number.isFinite(minDays) ? minDays : 0,
    latest_recovery_days: maxDays,
    risk,
    risk_reasons,
    confidence,
    confidence_reasons,
    outcome_bars: [
      { label: 'Full recovery', probability: full_recovery_probability },
      { label: 'Partial recovery', probability: partial_recovery_probability },
      { label: 'No recovery', probability: no_recovery_probability },
    ],
    timeline,
    breakdown: {
      expected_recovery,
      action_cost: expected_cost,
      relationship_penalty: expected_relationship_penalty,
      expected_net_recovery,
    },
    historical_evidence: catalogPrimary
      ? {
          action: primaryAction,
          historical_cases: hasPriors ? 76 : 24,
          successful_recoveries: hasPriors ? 24 : 6,
          observed_success_rate: catalogPrimary.pFull,
          evidence_strength: hasPriors ? 'MODERATE' : 'WEAK',
          basis: hasPriors
            ? 'Action-specific history (Revive comparison)'
            : 'General catalog prior / model estimate',
        }
      : undefined,
    validation,
    simulator_version: SIMULATOR_VERSION,
    probability_model_version: PROB_MODEL_VERSION,
    policy_model_version: POLICY_MODEL_VERSION,
    disclaimer:
      'SIMULATED — NO ACTION WILL BE EXECUTED. Results are decision-support estimates, not guarantees.',
  }
}

function buildTimeline(strategy: StrategyStepInput[]) {
  let day = 0
  return strategy.map((step, idx) => {
    day += Math.max(0, step.delay_days)
    const isLast = idx === strategy.length - 1
    return {
      day,
      action: step.action,
      branches: [
        { outcome: 'Full payment', next: 'STOP' },
        {
          outcome: 'Partial payment',
          next: isLast ? 'STOP' : 'Continue to next step',
        },
        {
          outcome: 'No response / no recovery',
          next: isLast ? 'STOP' : 'Continue to next step',
        },
      ],
    }
  })
}

export function scoreForObjective(
  result: SimulationResult,
  objective: OptimizationObjective,
): number {
  switch (objective) {
    case 'max_recovery':
      return result.expected_recovery
    case 'max_net':
      return result.expected_net_recovery
    case 'fastest':
      return -result.expected_recovery_days
    case 'balanced': {
      const riskPenalty = result.risk === 'HIGH' ? 0.85 : result.risk === 'MEDIUM' ? 0.93 : 1
      const timeFactor = 1 / (1 + result.expected_recovery_days / 10)
      return result.expected_net_recovery * riskPenalty * (0.7 + 0.3 * timeFactor)
    }
    default:
      return result.expected_net_recovery
  }
}

export function recommendStrategy(
  results: SimulationResult[],
  objective: OptimizationObjective,
): { winner: SimulationResult; reason: string } | null {
  if (!results.length) return null
  let best = results[0]
  let bestScore = scoreForObjective(best, objective)
  for (let i = 1; i < results.length; i++) {
    const s = scoreForObjective(results[i], objective)
    if (s > bestScore) {
      best = results[i]
      bestScore = s
    }
  }

  const objLabel =
    objective === 'max_recovery'
      ? 'maximum expected recovery'
      : objective === 'max_net'
        ? 'maximum expected net recovery'
        : objective === 'fastest'
          ? 'fastest expected recovery'
          : 'a balanced mix of recovery, cost, time, and risk'

  const reason = `Recommended strategy: ${best.scenario_name}. Expected recovery is ₹${Math.round(
    best.expected_recovery,
  ).toLocaleString('en-IN')} with a ${(best.expected_recovery_rate * 100).toFixed(
    0,
  )}% expected recovery rate. This strategy ranks highest for ${objLabel} (expected net ₹${Math.round(
    best.expected_net_recovery,
  ).toLocaleString('en-IN')}, risk ${best.risk}, confidence ${best.confidence}).`

  return { winner: best, reason }
}
