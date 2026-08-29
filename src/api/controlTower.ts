import { apiGet } from './client'

export type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'ATTENTION_REQUIRED' | 'OFFLINE'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ControlTowerAlertConfig {
  recovery_window_warning_days: number
  critical_recovery_window_days: number
  large_exposure_threshold: number
  max_execution_retries: number
  low_confidence_threshold: number
}

export interface ControlTowerKpis {
  revenue_at_risk: number
  amount_recovered: number
  active_cases: number
  recovery_rate: number
  autonomous_executions: number
  human_escalations: number
  execution_success: number
  execution_attempts: number
  execution_success_rate: number
  policy_violations: number
  universe_cases: number
  pipeline_cases: number
}

export interface ControlTowerOverview {
  system_status: SystemStatus
  status_reason: string
  generated_at: string
  kpis: ControlTowerKpis
  alert_config: ControlTowerAlertConfig
}

export interface PipelineStage {
  id: string
  label: string
  count: number
  cumulative_count: number
  pct_of_total: number
  intervention_count: number
  states: string[]
}

export interface ControlTowerPipeline {
  total_cases: number
  stages: PipelineStage[]
  state_distribution: Record<string, number>
  generated_at: string
}

export interface ActivityItem {
  id: string
  timestamp?: string | null
  case_id: string
  customer_name?: string | null
  action?: string | null
  amount?: number | null
  result?: string | null
  next_state?: string | null
  tone: 'ok' | 'warn' | 'bad' | 'info'
  detail?: string | null
}

export interface ControlTowerActivity {
  items: ActivityItem[]
  generated_at: string
}

export interface AttentionItem {
  case_id: string
  customer_name?: string | null
  outstanding_amount?: number | null
  severity: Severity
  reason: string
  recommended_action?: string | null
  root_cause?: string | null
  confidence?: number | null
  recovery_window_days?: number | null
  current_state: string
  cta: string
  cta_href: string
}

export interface ControlTowerAttention {
  items: AttentionItem[]
  generated_at: string
}

export interface FunnelStep {
  id: string
  label: string
  count?: number | null
  amount?: number | null
}

export interface ControlTowerPerformance {
  revenue_at_risk: number
  amount_recovered: number
  expected_recovery?: number | null
  recovery_rate: number
  full_recovery_rate: number
  partial_recovery_rate: number
  no_recovery_rate: number
  autonomous_success_rate: number
  human_escalation_rate: number
  policy_block_rate: number
  funnel: FunnelStep[]
  generated_at: string
}

export interface ServiceHealth {
  id: string
  label: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  detail?: string | null
}

export interface ReliabilitySnapshot {
  duplicate_prevention?: string | null
  state_conflicts: number
  policy_violations: number
  technical_failures: number
  authorization_compliance?: string | null
  aborted_executions: number
}

export interface ControlTowerSystemHealth {
  overall: SystemStatus
  services: ServiceHealth[]
  reliability: ReliabilitySnapshot
  generated_at: string
}

export const controlTowerApi = {
  overview: () => apiGet<ControlTowerOverview>('/control-tower/overview'),
  pipeline: () => apiGet<ControlTowerPipeline>('/control-tower/pipeline'),
  activity: (limit = 40) =>
    apiGet<ControlTowerActivity>('/control-tower/activity', { limit }),
  attention: (limit = 30) =>
    apiGet<ControlTowerAttention>('/control-tower/attention', { limit }),
  performance: () => apiGet<ControlTowerPerformance>('/control-tower/performance'),
  systemHealth: () => apiGet<ControlTowerSystemHealth>('/control-tower/system-health'),
}
