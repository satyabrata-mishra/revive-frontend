import { apiGet, apiPost } from './client'
import type { PolicyResponse } from './types'

export const policyApi = {
  get: (caseId: string) => apiGet<PolicyResponse>(`/cases/${caseId}/policy`),
  validate: (caseId: string, action: string) =>
    apiPost<PolicyResponse>(`/cases/${caseId}/validate-action`, { action }),
  version: () => apiGet<{ policy_version: string }>('/policy/version'),
  rules: () =>
    apiGet<{ rules: string[]; decisions: string[] }>('/policy/rules'),
}
