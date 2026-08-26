import { apiGet, apiPost } from './client'
import type {
  ActionComparison,
  CaseForecast,
  CustomerForecast,
  ForecastSummary,
  PortfolioSimulation,
  RecoveryTrend,
  RecoveryVelocity,
  RiskHeatmap,
  RootCauseIntelligence,
} from './types'

export const forecastApi = {
  summary: () => apiGet<ForecastSummary>('/forecast/summary'),
  case: (caseId: string) => apiGet<CaseForecast>(`/forecast/cases/${caseId}`),
  customer: (customerId: string) =>
    apiGet<CustomerForecast>(`/forecast/customer/${customerId}`),
}

export const simulationApi = {
  actionComparison: (caseId: string) =>
    apiGet<ActionComparison>(`/simulation/action-comparison/${caseId}`),
  portfolio: (body?: {
    priority?: string
    include_human_gated?: boolean
    autonomous_only?: boolean
  }) => apiPost<PortfolioSimulation>('/simulation/portfolio', body || { priority: 'P1' }),
}

export const analyticsApi = {
  recoveryTrend: (days = 30) =>
    apiGet<RecoveryTrend>('/analytics/recovery-trend', { days }),
  recoveryVelocity: () => apiGet<RecoveryVelocity>('/analytics/recovery-velocity'),
  rootCauses: () => apiGet<RootCauseIntelligence>('/analytics/root-causes'),
  riskHeatmap: () => apiGet<RiskHeatmap>('/analytics/risk-heatmap'),
}
