import { apiGet } from './client'
import type { ActionsResponse, DecisionResponse } from './types'

export const decisionApi = {
  decision: (caseId: string) =>
    apiGet<DecisionResponse>(`/cases/${caseId}/decision`),
  actions: (caseId: string) =>
    apiGet<ActionsResponse>(`/cases/${caseId}/actions`),
  counterfactuals: (caseId: string) =>
    apiGet<ActionsResponse>(`/cases/${caseId}/counterfactuals`),
}
