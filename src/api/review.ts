import { apiGet, apiPost } from './client'
import type {
  Paginated,
  ReviewCount,
  ReviewDecisionResponse,
  ReviewQueueItem,
} from './types'

export const reviewApi = {
  queue: (params: { status?: string; limit?: number; offset?: number } = {}) =>
    apiGet<Paginated<ReviewQueueItem>>('/review/queue', params),
  count: () => apiGet<ReviewCount>('/review/queue/count'),
  get: (caseId: string) => apiGet<ReviewQueueItem>(`/review/${caseId}`),
  approve: (
    caseId: string,
    body: { note?: string; action?: string; execute?: boolean } = {},
  ) => apiPost<ReviewDecisionResponse>(`/review/${caseId}/approve`, body),
  reject: (caseId: string, note?: string) =>
    apiPost<ReviewDecisionResponse>(`/review/${caseId}/reject`, { note }),
  escalate: (caseId: string, note?: string) =>
    apiPost<ReviewDecisionResponse>(`/review/${caseId}/escalate`, { note }),
}
