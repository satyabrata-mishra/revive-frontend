import { apiGet, apiPost } from './client'

export type ChatFact = {
  label: string
  value: string
  unit?: string | null
}

export type ChatCitation = {
  label: string
  source: string
  case_id?: string | null
}

export type ChatBlock = {
  type: 'table' | 'metric_row' | 'case_card' | 'disclaimer' | 'links' | 'text'
  title?: string | null
  columns?: string[] | null
  rows?: string[][] | null
  metrics?: ChatFact[] | null
  text?: string | null
  href?: string | null
  case_id?: string | null
  items?: { label: string; href: string }[] | null
}

export type ChatUiAction = {
  type: 'navigate'
  label: string
  href: string
}

export type ChatTurnResponse = {
  conversation_id: string
  message_id: string
  intent: string
  answer: { markdown: string; summary: string }
  facts: ChatFact[]
  analysis?: string | null
  citations: ChatCitation[]
  blocks: ChatBlock[]
  suggested_followups: string[]
  ui_actions: ChatUiAction[]
  confidence: 'high' | 'medium' | 'low' | 'refused'
  refusals: string[]
  tools_used: string[]
  provider: string
}

export type ConversationSummary = {
  conversation_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export type ConversationDetail = {
  conversation_id: string
  title: string
  created_at: string
  updated_at: string
  messages: Array<{
    message_id: string
    role: 'user' | 'assistant'
    text: string
    timestamp: string
    payload?: ChatTurnResponse
  }>
  active_entities: Record<string, unknown>
}

export const chatApi = {
  createConversation: (title?: string) =>
    apiPost<ConversationSummary>('/chat/conversations', title ? { title } : {}),
  listConversations: () =>
    apiGet<{ items: ConversationSummary[] }>('/chat/conversations'),
  getConversation: (id: string) =>
    apiGet<ConversationDetail>(`/chat/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    apiPost<ConversationSummary>(`/chat/conversations/${id}/rename`, { title }),
  deleteConversation: (id: string) =>
    apiPost<{ status: string; message: string }>(
      `/chat/conversations/${id}/delete`,
      {},
    ),
  sendMessage: (id: string, message: string) =>
    apiPost<ChatTurnResponse>(`/chat/conversations/${id}/messages`, { message }),
}
