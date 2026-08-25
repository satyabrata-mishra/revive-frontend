import { apiGet } from './client'
import type {
  DashboardCohorts,
  DashboardPipeline,
  DashboardRecovery,
  DashboardSummary,
} from './types'

export const dashboardApi = {
  summary: () => apiGet<DashboardSummary>('/dashboard/summary'),
  recovery: () => apiGet<DashboardRecovery>('/dashboard/recovery'),
  pipeline: () => apiGet<DashboardPipeline>('/dashboard/pipeline'),
  cohorts: () => apiGet<DashboardCohorts>('/dashboard/cohorts'),
  reliability: () => apiGet<Record<string, unknown>>('/dashboard/reliability'),
  actions: () => apiGet<Record<string, unknown>>('/dashboard/actions'),
  priorities: () => apiGet<Record<string, unknown>>('/dashboard/priorities'),
}
