/** Types mirroring Day-13 FastAPI response schemas. */

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface DashboardSummary {
  universe_cases: number
  pipeline_cases: number
  p1_cases: number | null
  revenue_at_risk_universe: number
  revenue_at_risk_pipeline: number
  amount_recovered: number
  recovery_rate: number
  recovery_rate_denominator: string
  human_escalations: number
  successful_executions: number
  active_cases: number
  closed_cases: number
  escalated_cases: number
  note?: string
}

export interface DashboardRecovery {
  cohort: string
  revenue_at_risk: number
  amount_recovered: number
  outstanding_remaining: number
  gross_recovery_rate: number
  full_recovery_rate: number
  partial_recovery_rate: number
  no_recovery_rate: number
  net_recovery?: number | null
  recovery_cost?: number | null
  recovery_roi?: number | null
}

export interface DashboardPipeline {
  state_distribution: Record<string, number>
  system_status_distribution: Record<string, number>
  source: string
}

export interface DashboardCohorts {
  universe: Record<string, unknown>
  pipeline: Record<string, unknown>
  execution: Record<string, unknown>
  note?: string
}

export interface CaseSummary {
  case_id: string
  invoice_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  current_state: string
  system_status: string
  priority_level?: string | null
  root_cause?: string | null
  outstanding_amount?: number | null
  amount_recovered?: number | null
  authorized_action?: string | null
  recommended_action?: string | null
  customer_aware?: boolean | null
  invoice_status?: string | null
}

export interface DiagnosisResponse {
  case_id: string
  root_cause?: string | null
  confidence?: number | null
  confidence_band?: string | null
  payment_intent?: string | null
  payment_intent_confidence?: number | null
  secondary_root_causes: string[]
  evidence: unknown[]
  investigation_targets: string[]
  reasoning?: string | null
}

export interface ActionCandidate {
  action: string
  allowed: boolean
  policy_decision?: string | null
  expected_recovery?: number | null
  recovery_probability?: number | null
  eav?: number | null
  confidence?: string | null
  action_cost?: number | null
  evidence?: Record<string, unknown> | null
}

export interface ActionsResponse {
  case_id: string
  actions: ActionCandidate[]
  recommended_action?: string | null
  source: string
  customer_aware: boolean
}

export interface DecisionResponse {
  case_id: string
  day5_primary_action?: string | null
  day6_authorized_action?: string | null
  day6_decision?: string | null
  selected_action?: string | null
  selected_eav?: number | null
  selected_confidence?: string | null
  evidence_level?: string | null
  customer_aware: boolean
  customer_observations?: number | null
  decision_reason?: Record<string, unknown> | null
  source: string
}

export interface PolicyResponse {
  case_id: string
  requested_action?: string | null
  authorized_action?: string | null
  decision?: string | null
  allowed: boolean
  requires_human_approval: boolean
  violations: unknown[]
  rules_evaluated: string[]
  rules_passed: string[]
  rules_failed: string[]
  policy_version?: string | null
  policy_reasons: string[]
  checks?: Record<string, { passed?: boolean; message?: string; basis?: string }> | null
  live: boolean
}

export interface MonitorResponse {
  case_id: string
  current_status?: string | null
  current_state?: string | null
  outcome_type?: string | null
  amount_recovered?: number | null
  outstanding?: number | null
  outstanding_before?: number | null
  continue_recovery?: boolean | null
  loop_decision?: string | null
  stop_reason?: string | null
  next_action?: string | null
  next_action_detail?: Record<string, unknown> | null
}

export interface CaseLedger {
  case_id: string
  invoice_id?: string | null
  outstanding_before: number
  amount_recovered: number
  outstanding_after: number
  recovery_rate: number
  recovery_cost: number
  net_recovery: number
  action?: string | null
}

export interface AuditEvent {
  timestamp?: string | null
  event: string
  case_id?: string | null
  detail?: unknown
}

export interface AuditTimeline {
  case_id: string
  events: AuditEvent[]
  event_names: string[]
}

export interface AuditCaseSummary extends CaseSummary {
  event_count: number
  last_event_at?: string | null
  live_activity: boolean
}

export interface AuditListParams {
  q?: string
  state?: string
  limit?: number
  offset?: number
}

export interface CaseExplanation {
  case_id: string
  decision_reason?: Record<string, unknown> | null
  why_this_customer: string[]
  customer_aware: boolean
  evidence_level?: string | null
}

export interface CaseStateView {
  case_id: string
  current_state: string
  system_status: string
  state_path: string[]
  allowed_transitions: string[]
}

export interface ReviewQueueItem {
  case_id: string
  customer_id?: string | null
  customer_name?: string | null
  invoice_id?: string | null
  outstanding_amount?: number | null
  root_cause?: string | null
  requested_action?: string | null
  authorized_action?: string | null
  policy_decision?: string | null
  current_state: string
  reason?: string | null
  review_status: string
}

export interface ReviewCount {
  count: number
  pending: number
  approved: number
  rejected: number
  escalated: number
}

export interface ReviewDecisionResponse {
  case_id: string
  review_status: string
  note?: string | null
  authorized_action?: string | null
  message: string
}

export interface ExecutionDetail {
  execution_id: string
  case_id: string
  invoice_id?: string | null
  authorized_action?: string | null
  execution_status?: string | null
  started_at?: string | null
  completed_at?: string | null
  outstanding_before?: number | null
  amount_recovered?: number | null
  outstanding_after?: number | null
  audit_events: string[]
  pipeline_status?: string | null
  next_stage?: string | null
  retry_count: number
}

export interface ExecutePreviewResponse {
  case_id: string
  action: string
  dry_run: boolean
  execution_allowed: boolean
  authorization_valid: boolean
  abort_reason?: string | null
  skip_reason?: string | null
  idempotency_key?: string | null
  policy_decision?: string | null
  message: string
}

export interface ExecuteResponse {
  case_id: string
  execution_id?: string | null
  action?: string | null
  execution_status: string
  abort_reason?: string | null
  pipeline_status?: string | null
  next_stage?: string | null
  amount_recovered: number
  outstanding_before?: number | null
  outstanding_after?: number | null
  ledger_delta?: Record<string, unknown> | null
  audit_events: string[]
  payment_event?: Record<string, unknown> | null
  dry_run: boolean
  idempotency_key?: string | null
  failure_handling?: Record<string, unknown> | null
  monitoring_outcome?: string | null
  next_action?: string | null
  monitoring_message?: string | null
  current_state?: string | null
}

export interface MonitorRunResponse {
  case_id: string
  outcome_type?: string | null
  loop_decision?: string | null
  stop_reason?: string | null
  next_action?: string | null
  next_action_detail?: Record<string, unknown> | null
  current_state: string
  continue_recovery: boolean
  pipeline_status?: string | null
  message: string
}

/** Unified Day-12 case document (partial — UI reads known nests). */
export interface UnifiedCase {
  case_id: string
  current_state: string
  system_status: string
  invoice?: Record<string, unknown>
  customer?: Record<string, unknown>
  detection?: Record<string, unknown>
  diagnosis?: Record<string, unknown>
  strategy?: Record<string, unknown>
  authorization?: Record<string, unknown>
  execution?: Record<string, unknown>
  outcome?: Record<string, unknown>
  optimization?: Record<string, unknown>
  audit_trail?: AuditEvent[]
  ledger?: CaseLedger
  [key: string]: unknown
}

export interface CaseListParams {
  priority?: string
  state?: string
  root_cause?: string
  invoice_status?: string
  q?: string
  limit?: number
  offset?: number
}
