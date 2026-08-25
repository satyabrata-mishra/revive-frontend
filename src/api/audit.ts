import { apiGet } from './client'
import type { AuditCaseSummary, AuditListParams, AuditTimeline, Paginated } from './types'

export const auditApi = {
  listCases: (params: AuditListParams = {}) =>
    apiGet<Paginated<AuditCaseSummary>>('/audit/cases', { ...params }),

  compact: (caseId: string) =>
    apiGet<{ case_id: string; events: string[] }>(`/cases/${caseId}/audit`),
  timeline: (caseId: string) =>
    apiGet<AuditTimeline>(`/cases/${caseId}/timeline`),
}
