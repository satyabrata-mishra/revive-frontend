import { apiGet } from './client'
import type {
  CaseExplanation,
  CaseLedger,
  CaseListParams,
  CaseStateView,
  CaseSummary,
  DiagnosisResponse,
  Paginated,
  UnifiedCase,
} from './types'

export const casesApi = {
  list: (params: CaseListParams = {}) =>
    apiGet<Paginated<CaseSummary>>('/cases', { ...params }),

  search: (q: string, limit = 50, offset = 0) =>
    apiGet<Paginated<CaseSummary>>('/cases/search', { q, limit, offset }),

  get: (caseId: string) => apiGet<UnifiedCase>(`/cases/${caseId}`),

  summary: (caseId: string) => apiGet<CaseSummary>(`/cases/${caseId}/summary`),

  state: (caseId: string) => apiGet<CaseStateView>(`/cases/${caseId}/state`),

  diagnosis: (caseId: string) =>
    apiGet<DiagnosisResponse>(`/cases/${caseId}/diagnosis`),

  explanation: (caseId: string) =>
    apiGet<CaseExplanation>(`/cases/${caseId}/explanation`),

  ledger: (caseId: string) => apiGet<CaseLedger>(`/cases/${caseId}/ledger`),

  queue: (name: string, limit = 50, offset = 0) =>
    apiGet<Paginated<CaseSummary>>(`/queues/${name}`, { limit, offset }),
}
