import { apiGet, apiPost } from './client'
import type {
  ExecutePreviewResponse,
  ExecuteResponse,
  ExecutionDetail,
  Paginated,
} from './types'

export const executionApi = {
  listForCase: (caseId: string) =>
    apiGet<ExecutionDetail[]>(`/cases/${caseId}/executions`),
  get: (executionId: string) =>
    apiGet<ExecutionDetail>(`/executions/${executionId}`),
  list: (params: { status?: string; limit?: number; offset?: number } = {}) =>
    apiGet<Paginated<ExecutionDetail>>('/executions', params),
  preview: (caseId: string, action: string) =>
    apiPost<ExecutePreviewResponse>(`/cases/${caseId}/execute/preview`, {
      action,
    }),
  execute: (caseId: string, action: string, idempotencyKey?: string) =>
    apiPost<ExecuteResponse>(
      `/cases/${caseId}/execute`,
      { action },
      idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    ),
}
