import { apiGet, apiPost } from './client'

export type CopilotEvidenceItem = {
  label: string
  value: string
  source?: string | null
}

export type CopilotRecommendation = {
  action?: string | null
  confidence?: string | null
  expected_recovery?: number | null
  recovery_probability?: number | null
  recovery_window_days?: number | null
  why?: string[]
  allowed?: boolean | null
  requires_human_approval?: boolean | null
}

export type CopilotAlternative = {
  action: string
  expected_recovery?: number | null
  eav?: number | null
  confidence?: string | null
  allowed?: boolean | null
  policy_decision?: string | null
}

export type CopilotUiAction = {
  type: 'navigate' | 'confirm_execute' | 'request_approval' | 'ask_reviveiq'
  label: string
  href?: string | null
  action?: string | null
}

export type CopilotChatResponse = {
  session_id: string
  case_id: string
  message_id: string
  intent: string
  answer: string
  summary?: string | null
  evidence: CopilotEvidenceItem[]
  recommendation?: CopilotRecommendation | null
  alternatives: CopilotAlternative[]
  policy_brief?: string | null
  draft_message?: {
    subject?: string
    body?: string
    tone?: string
    warnings?: string[]
    facts_used?: string[]
  } | null
  next_step?: string | null
  requires_confirmation: boolean
  handoff?: { product?: string; href?: string; reason?: string } | null
  suggested_followups: string[]
  ui_actions: CopilotUiAction[]
  confidence: 'high' | 'medium' | 'low' | 'refused'
  refusals: string[]
  tools_used: string[]
}

export type CopilotCaseContext = {
  case_id: string
  current_state?: string | null
  customer_name?: string | null
  customer_id?: string | null
  risk_profile?: string | null
  invoice_id?: string | null
  outstanding_amount?: number | null
  days_overdue?: number | null
  invoice_status?: string | null
  priority_level?: string | null
  recovery_probability?: number | null
  actionability_score?: number | null
  root_cause?: string | null
  root_cause_confidence?: number | null
  payment_intent?: string | null
  expected_recovery?: number | null
  recommended_action?: string | null
  policy_decision?: string | null
  requires_human_approval?: boolean | null
  open_dispute: boolean
  contact_preferences?: string | null
}

export type CopilotSuggestionsResponse = {
  case_id: string
  state?: string | null
  suggestions: string[]
}

export type CopilotActionPreviewResponse = {
  case_id: string
  action: string
  execution_allowed: boolean
  policy_decision?: string | null
  abort_reason?: string | null
  skip_reason?: string | null
  message: string
  requires_human_approval: boolean
  outstanding_amount?: number | null
  expected_recovery?: number | null
}

export type CopilotDraftResponse = {
  case_id: string
  tone: string
  subject: string
  body: string
  channel: string
  facts_used: string[]
  contact_preferences?: string | null
  warnings: string[]
}

export const copilotApi = {
  chat: (body: { case_id: string; message: string; session_id?: string }) =>
    apiPost<CopilotChatResponse>('/copilot/chat', body),
  context: (caseId: string) =>
    apiGet<CopilotCaseContext>(`/copilot/cases/${caseId}/context`),
  suggestions: (caseId: string) =>
    apiGet<CopilotSuggestionsResponse>(`/copilot/cases/${caseId}/suggestions`),
  policyExplanation: (caseId: string) =>
    apiGet<{ plain_english: string; decision?: string; open_dispute: boolean }>(
      `/copilot/cases/${caseId}/policy-explanation`,
    ),
  draftMessage: (caseId: string, body?: { tone?: string; action?: string }) =>
    apiPost<CopilotDraftResponse>(`/copilot/cases/${caseId}/draft-message`, body || {}),
  counterfactual: (caseId: string, alternative_action: string) =>
    apiPost<{
      current_action?: string
      current_expected_recovery?: number
      alternative_action: string
      alternative_expected_recovery?: number
      difference?: number
      why: string
    }>(`/copilot/cases/${caseId}/counterfactual`, { alternative_action }),
  actionPreview: (caseId: string, action: string) =>
    apiPost<CopilotActionPreviewResponse>(`/copilot/cases/${caseId}/action-preview`, {
      action,
    }),
  getSession: (sessionId: string) =>
    apiGet<{
      session_id: string
      case_id: string
      messages: Array<{
        message_id: string
        role: 'user' | 'assistant'
        text: string
        timestamp: string
        payload?: CopilotChatResponse
      }>
    }>(`/copilot/sessions/${sessionId}`),
}
