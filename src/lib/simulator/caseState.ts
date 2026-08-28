import type { ActionComparison, CaseSummary, UnifiedCase } from '../../api/types'

function nest(obj: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

/** Observed case state used as the simulation baseline. */
export interface SimulatorCaseState {
  case_id: string
  invoice_id?: string
  customer_id?: string
  customer_name?: string
  outstanding: number
  original_amount?: number
  amount_recovered: number
  days_overdue: number
  invoice_status?: string
  priority?: string
  root_cause?: string
  root_cause_confidence?: number
  payment_intent?: string
  system_status: string
  current_state: string
  recovery_window_days: number
  customer_opt_out: boolean
  active_dispute: boolean
  human_approval_required: boolean
  previous_action?: string
  max_contacts: number
  contacts_used: number
  /** Observed vs assumed labels for UI. */
  field_sources: Record<string, 'observed' | 'historical' | 'model-estimated' | 'default'>
}

export function caseStateFromUnified(
  uc: UnifiedCase,
  summary?: CaseSummary | null,
): SimulatorCaseState {
  const inv = uc.invoice as Record<string, unknown> | undefined
  const cust = uc.customer as Record<string, unknown> | undefined
  const diag = uc.diagnosis as Record<string, unknown> | undefined
  const det = uc.detection as Record<string, unknown> | undefined
  const auth = uc.authorization as Record<string, unknown> | undefined
  const ledger = uc.ledger

  const outstanding =
    num(ledger?.outstanding_after) ??
    num(nest(inv, 'outstanding_amount')) ??
    num(nest(inv, 'amount_outstanding')) ??
    num(summary?.outstanding_amount) ??
    0

  const original =
    num(nest(inv, 'original_amount')) ??
    num(nest(inv, 'invoice_amount')) ??
    num(nest(inv, 'amount'))

  const days =
    num(nest(inv, 'days_overdue')) ??
    num(nest(det, 'days_overdue')) ??
    num(nest(cust, 'days_overdue')) ??
    0

  const rootCause =
    str(nest(diag, 'root_cause')) ??
    str(nest(diag, 'primary_root_cause')) ??
    str(summary?.root_cause)

  const confidence =
    num(nest(diag, 'confidence')) ?? num(nest(diag, 'root_cause_confidence'))

  const intent =
    str(nest(diag, 'payment_intent')) ?? str(nest(cust, 'payment_intent'))

  const dispute =
    bool(nest(cust, 'active_dispute')) ??
    (rootCause === 'DISPUTE' ||
      str(summary?.invoice_status)?.toUpperCase().includes('DISPUTE') === true)

  const optOut =
    bool(nest(cust, 'opt_out')) ??
    bool(nest(cust, 'communication_opt_out')) ??
    false

  const humanApproval =
    bool(auth?.requires_human_approval) ?? str(auth?.decision) === 'REQUIRES_HUMAN'

  const windowDays =
    num(nest(uc.strategy as Record<string, unknown> | undefined, 'recovery_window_days')) ??
    num(nest(uc.optimization as Record<string, unknown> | undefined, 'recovery_window_days')) ??
    Math.max(7, 30 - days)

  const field_sources: SimulatorCaseState['field_sources'] = {
    outstanding: ledger || inv || summary ? 'observed' : 'default',
    days_overdue: inv || det ? 'observed' : 'default',
    root_cause: diag || summary?.root_cause ? 'observed' : 'default',
    payment_intent: diag || cust ? 'observed' : 'default',
    recovery_window_days: 'model-estimated',
    customer_opt_out: cust ? 'observed' : 'default',
    active_dispute: 'observed',
  }

  return {
    case_id: uc.case_id,
    invoice_id: str(nest(inv, 'invoice_id')) ?? str(summary?.invoice_id),
    customer_id: str(nest(cust, 'customer_id')) ?? str(summary?.customer_id),
    customer_name: str(nest(cust, 'customer_name')) ?? str(summary?.customer_name),
    outstanding,
    original_amount: original,
    amount_recovered: num(ledger?.amount_recovered) ?? num(summary?.amount_recovered) ?? 0,
    days_overdue: days,
    invoice_status: str(nest(inv, 'status')) ?? str(summary?.invoice_status),
    priority: str(summary?.priority_level) ?? str(nest(det, 'priority_level')),
    root_cause: rootCause,
    root_cause_confidence: confidence,
    payment_intent: intent,
    system_status: uc.system_status,
    current_state: uc.current_state,
    recovery_window_days: windowDays,
    customer_opt_out: Boolean(optOut),
    active_dispute: Boolean(dispute),
    human_approval_required: Boolean(humanApproval),
    previous_action:
      str(nest(uc.execution as Record<string, unknown> | undefined, 'authorized_action')) ??
      str(summary?.authorized_action),
    max_contacts: 5,
    contacts_used: 0,
    field_sources,
  }
}

export function caseStateFromSummary(summary: CaseSummary): SimulatorCaseState {
  return {
    case_id: summary.case_id,
    invoice_id: summary.invoice_id ?? undefined,
    customer_id: summary.customer_id ?? undefined,
    customer_name: summary.customer_name ?? undefined,
    outstanding: summary.outstanding_amount ?? 0,
    amount_recovered: summary.amount_recovered ?? 0,
    days_overdue: 0,
    invoice_status: summary.invoice_status ?? undefined,
    priority: summary.priority_level ?? undefined,
    root_cause: summary.root_cause ?? undefined,
    system_status: summary.system_status,
    current_state: summary.current_state,
    recovery_window_days: 21,
    customer_opt_out: false,
    active_dispute: summary.root_cause === 'DISPUTE',
    human_approval_required: false,
    previous_action: summary.authorized_action ?? undefined,
    max_contacts: 5,
    contacts_used: 0,
    field_sources: {
      outstanding: 'observed',
      days_overdue: 'default',
      root_cause: summary.root_cause ? 'observed' : 'default',
      recovery_window_days: 'default',
    },
  }
}

/** Blend catalog priors with backend action-comparison rows when present. */
export function actionPriorsFromComparison(
  comparison: ActionComparison | null | undefined,
): Record<
  string,
  { pFull: number; pPartial: number; pNone: number; actionCost: number; expectedRecovery?: number }
> {
  if (!comparison?.actions?.length) return {}
  const out: Record<
    string,
    { pFull: number; pPartial: number; pNone: number; actionCost: number; expectedRecovery?: number }
  > = {}
  for (const row of comparison.actions) {
    const p = row.recovery_probability
    if (p == null || p < 0 || p > 1) continue
    const pFull = Math.min(0.92, Math.max(0.02, p * 0.85))
    const pPartial = Math.min(0.5, Math.max(0.05, (1 - pFull) * 0.45))
    const pNone = Math.max(0.02, 1 - pFull - pPartial)
    const sum = pFull + pPartial + pNone
    out[row.action] = {
      pFull: pFull / sum,
      pPartial: pPartial / sum,
      pNone: pNone / sum,
      actionCost: row.action_cost ?? 0,
      expectedRecovery: row.expected_recovery,
    }
  }
  return out
}
