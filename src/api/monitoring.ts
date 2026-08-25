import { apiGet, apiPost } from './client'
import type { MonitorResponse, MonitorRunResponse } from './types'

export const monitoringApi = {
  monitor: (caseId: string) =>
    apiGet<MonitorResponse>(`/cases/${caseId}/monitor`),
  run: (caseId: string) =>
    apiPost<MonitorRunResponse>(`/cases/${caseId}/monitor/run`),
  outcome: (caseId: string) =>
    apiGet<Record<string, unknown>>(`/cases/${caseId}/outcome`),
  nextAction: (caseId: string) =>
    apiGet<Record<string, unknown>>(`/cases/${caseId}/next-action`),
}
