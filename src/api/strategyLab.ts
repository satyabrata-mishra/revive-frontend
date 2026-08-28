import { apiGet, apiPost } from './client'
import { ApiError } from './client'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export interface PopulationFilters {
  priorities: string[]
  root_causes: string[]
  min_outstanding: number
  max_outstanding?: number | null
  exclude_opt_out: boolean
  exclude_dispute: boolean
}

export interface StrategyKnobs {
  human_escalation_threshold: number
  recovery_window_days: number
  max_contacts: number
  automation_bias: number
  prefer_payment_link: boolean
  billing_fix_first: boolean
}

export interface StrategyRecord {
  strategy_id: string
  version: number
  name: string
  description: string
  objective: string
  status: string
  preset_id?: string | null
  population: PopulationFilters
  knobs: StrategyKnobs
  created_at: string
  updated_at: string
  approved_at?: string | null
}

export interface PopulationPreview {
  total_open_cases: number
  matching_cases: number
  revenue_at_risk: number
  average_outstanding: number
  priority_breakdown: Record<string, number>
  root_cause_breakdown: Record<string, number>
  sample_case_ids: string[]
}

export interface PortfolioBaseline {
  open_cases: number
  revenue_at_risk: number
  expected_recovery: number
  expected_cost: number
  expected_net_recovery: number
  human_escalations: number
  contact_volume: number
  automation_rate: number
  disclaimer: string
}

export interface ExperimentMetrics {
  cases: number
  revenue_at_risk: number
  expected_recovery: number
  expected_cost: number
  expected_net_recovery: number
  recovery_rate: number
  human_escalations: number
  contact_volume: number
  automation_rate: number
  policy_blocked: number
}

export interface ExperimentResult {
  experiment_id: string
  strategy_id: string
  strategy_name: string
  strategy_version: number
  label: string
  created_at: string
  seed: number
  metrics: ExperimentMetrics
  explanation: string
  drivers: string[]
  action_mix: Record<string, number>
  disclaimer: string
}

export interface CompareResponse {
  rows: {
    experiment_id: string
    strategy_id: string
    label: string
    metrics: ExperimentMetrics
    recommended: boolean
  }[]
  recommendation: string
  tradeoffs: string[]
  winner_experiment_id?: string | null
  disclaimer: string
}

export interface StrategyPreset {
  preset_id: string
  name: string
  description: string
  knobs: StrategyKnobs
}

export interface ApproveResponse {
  strategy_id: string
  status: string
  message: string
  approved_at: string
}

export const strategyLabApi = {
  baseline: () => apiGet<PortfolioBaseline>('/strategy-lab/baseline'),
  presets: () => apiGet<{ items: StrategyPreset[] }>('/strategy-lab/presets'),
  previewPopulation: (population: PopulationFilters) =>
    apiPost<PopulationPreview>('/strategy-lab/population/preview', { population }),
  createStrategy: (body: {
    name?: string
    description?: string
    objective?: string
    preset_id?: string
    population?: PopulationFilters
    knobs?: StrategyKnobs
  }) => apiPost<StrategyRecord>('/strategy-lab/strategies', body),
  listStrategies: () => apiGet<StrategyRecord[]>('/strategy-lab/strategies'),
  getStrategy: (id: string) => apiGet<StrategyRecord>(`/strategy-lab/strategies/${id}`),
  updateStrategy: (
    id: string,
    body: {
      name?: string
      description?: string
      objective?: string
      population?: PopulationFilters
      knobs?: StrategyKnobs
    },
  ) => apiPut<StrategyRecord>(`/strategy-lab/strategies/${id}`, body),
  runExperiment: (body: { strategy_id: string; seed?: number; label?: string }) =>
    apiPost<ExperimentResult>('/strategy-lab/experiments', body),
  listExperiments: () => apiGet<ExperimentResult[]>('/strategy-lab/experiments'),
  compare: (experiment_ids: string[], objective = 'max_net') =>
    apiPost<CompareResponse>('/strategy-lab/experiments/compare', {
      experiment_ids,
      objective,
    }),
  approve: (strategy_id: string) =>
    apiPost<ApproveResponse>(`/strategy-lab/strategies/${strategy_id}/approve`),
}
