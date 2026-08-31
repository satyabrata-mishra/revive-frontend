import { apiGet, apiPost } from './client'

export type WarRoomSeverity = 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4'
export type WarRoomStatus =
  | 'DETECTED'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'ACTION_PLAN_READY'
  | 'MITIGATION_ACTIVE'
  | 'MONITORING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ESCALATED'
  | 'ABANDONED'

export type HealthTrend = 'CRITICAL' | 'HIGH' | 'STABLE' | 'IMPROVING' | 'RESOLVED'
export type PlanStepStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'BLOCKED'

export interface WarRoomSummary {
  incident_id: string
  title: string
  severity: WarRoomSeverity
  status: WarRoomStatus
  owner: string
  created_at: string
  updated_at: string
  duration_minutes: number
  revenue_at_risk: number
  amount_recovered: number
  affected_case_count: number
  health_score: number
  health_trend: HealthTrend
  primary_root_cause?: string | null
}

export interface WarRoomListResponse {
  items: WarRoomSummary[]
  generated_at: string
}

export interface WarRoomCaseRow {
  case_id: string
  customer_name?: string | null
  invoice_id?: string | null
  priority_level?: string | null
  outstanding_amount: number
  amount_recovered: number
  root_cause?: string | null
  recommended_action?: string | null
  current_state: string
  relationship_type: string
}

export interface PlanStep {
  step_id: string
  order: number
  action: string
  title: string
  reason: string
  expected_impact?: string | null
  expected_recovery?: number | null
  affected_case_count: number
  affected_case_ids: string[]
  risk?: string | null
  requires_approval: boolean
  policy_ok: boolean
  policy_notes: string[]
  status: PlanStepStatus
}

export interface TimelineEvent {
  event_id: string
  event_type: string
  timestamp: string
  actor: string
  description: string
  metadata?: Record<string, unknown>
}

export interface DecisionRecord {
  decision_id: string
  kind: string
  step_id?: string | null
  actor: string
  ai_recommendation?: string | null
  reason: string
  timestamp: string
  expected_impact?: string | null
}

export interface WarRoomDetail {
  incident_id: string
  title: string
  description: string
  severity: WarRoomSeverity
  status: WarRoomStatus
  phase: string
  owner: string
  trigger_type: string
  trigger_reason: string
  objective: string
  created_at: string
  updated_at: string
  resolved_at?: string | null
  duration_minutes: number
  impact: {
    revenue_at_risk: number
    amount_recovered: number
    outstanding_amount: number
    recovery_rate: number
    expected_recovery: number
    incremental_vs_baseline?: number | null
    affected_case_count: number
    affected_customer_count: number
    p1_count: number
    human_escalations: number
    cases_resolved: number
  }
  diagnosis: {
    primary_cause: string
    confidence: number
    affected_segment: string
    detection_signal: string
    evidence: { text: string; source?: string | null }[]
    cause_mix: { root_cause: string; count: number; share: number; outstanding: number }[]
  }
  plan: PlanStep[]
  timeline: TimelineEvent[]
  decisions: DecisionRecord[]
  cases: WarRoomCaseRow[]
  health: { score: number; trend: HealthTrend; factors: string[] }
  situation: {
    situation: string
    current_status: string
    primary_blocker: string
    recommendation: string
  }
  next_best_move: {
    title: string
    detail: string
    potential_revenue: number
    expected_recovery_probability?: number | null
    case_ids: string[]
    cta: string
    cta_href?: string | null
  }
  what_changed: {
    window_label: string
    items: { label: string; delta: number; direction: string }[]
    most_significant?: string | null
  }
  forecast: {
    horizon_label: string
    expected_recovery: number
    expected_unresolved: number
    resolution_probability: number
    scenarios: { label: string; expected_recovery: number }[]
  }
  postmortem?: {
    what_happened: string
    why: string
    what_revive_did: string
    what_worked: string
    what_failed: string
    recovered: number
    unrecovered: number
    recovery_rate: number
    best_intervention: string
    weakest_intervention: string
    key_learning: string
    recommended_policy_change: string
  } | null
  demo_seed: boolean
}

export const warRoomApi = {
  list: () => apiGet<WarRoomListResponse>('/war-room'),
  get: (incidentId: string) => apiGet<WarRoomDetail>(`/war-room/${incidentId}`),
  approveStep: (incidentId: string, stepId: string, actor = 'Revenue Operations') =>
    apiPost<WarRoomDetail>(`/war-room/${incidentId}/actions/${stepId}/approve`, { actor }),
  rejectStep: (incidentId: string, stepId: string, reason?: string) =>
    apiPost<WarRoomDetail>(`/war-room/${incidentId}/actions/${stepId}/reject`, {
      actor: 'Revenue Operations',
      reason: reason || 'Operator rejected coordinated action',
    }),
  comment: (incidentId: string, text: string) =>
    apiPost<WarRoomDetail>(`/war-room/${incidentId}/comments`, {
      actor: 'Revenue Operations',
      text,
    }),
  advanceDemo: (incidentId: string) =>
    apiPost<WarRoomDetail>(`/war-room/${incidentId}/advance-demo`, {}),
  resolve: (incidentId: string, note?: string) =>
    apiPost<WarRoomDetail>(`/war-room/${incidentId}/resolve`, {
      actor: 'Revenue Operations',
      note,
    }),
}
