import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  chatApi,
  type ChatBlock,
  type ChatTurnResponse,
  type ConversationSummary,
} from '../api/chat'
import { dashboardApi } from '../api/dashboard'
import type { DashboardSummary } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Loading } from '../components/ui'
import { formatINR } from '../utils/format'

type PromptCategoryId =
  | 'revenue'
  | 'customers'
  | 'recovery'
  | 'forecast'
  | 'cases'
  | 'about'

type PromptCategory = {
  id: PromptCategoryId
  icon: string
  label: string
  blurb: string
  prompts: string[]
}

const CATEGORIES: PromptCategory[] = [
  {
    id: 'revenue',
    icon: '📊',
    label: 'Revenue & Risk',
    blurb: 'Analyze risk',
    prompts: [
      'How much revenue is currently at risk?',
      'Show my highest-risk customers',
      'What is the current portfolio recovery rate?',
    ],
  },
  {
    id: 'customers',
    icon: '👥',
    label: 'Customers',
    blurb: 'Find overdue',
    prompts: [
      'How many customers have pending payments?',
      'Why is Nova Logix Digital not paying?',
      'What would you recommend for Epsilon Data Systems?',
      'Which customers need attention today?',
    ],
  },
  {
    id: 'recovery',
    icon: '💰',
    label: 'Recovery',
    blurb: 'Recovery ops',
    prompts: [
      'What is the expected 30-day recovery?',
      'Show recovery opportunities',
      'How much have we recovered so far?',
    ],
  },
  {
    id: 'forecast',
    icon: '🔮',
    label: 'Forecast',
    blurb: 'Predict recovery',
    prompts: [
      'What is the expected 30-day recovery?',
      'What is expected recovery in 7 days?',
      'Show risk heatmap',
    ],
  },
  {
    id: 'cases',
    icon: '📁',
    label: 'Cases',
    blurb: 'Case analysis',
    prompts: [
      'Why is RISK-00003 P1?',
      'What is the current status of RISK-00003?',
      'Show my highest-risk customers',
    ],
  },
  {
    id: 'about',
    icon: '✦',
    label: 'About Revive IQ',
    blurb: 'Product help',
    prompts: [
      'Who are you?',
      'What can you do?',
      'How can I use you?',
      'What are your limitations?',
    ],
  },
]

const FEATURED_PROMPTS = [
  'How much revenue is currently at risk?',
  'Which customers need attention today?',
  'Why is Nova Logix Digital not paying?',
  'What is my expected 30-day recovery?',
]

const QUICK_ACTIONS = [
  { label: 'Analyze Revenue', icon: '📊', prompt: 'How much revenue is currently at risk?' },
  { label: 'High-Risk Customers', icon: '⚠️', prompt: 'Show my highest-risk customers' },
  { label: 'Recovery Opportunities', icon: '💰', prompt: 'Show recovery opportunities' },
  { label: 'View Forecast', icon: '🔮', prompt: 'What is the expected 30-day recovery?' },
  { label: 'Summarize Cases', icon: '📋', prompt: 'What is the current status of RISK-00003?' },
]

const DIAGNOSTIC_INTENTS = new Set([
  'customer_why_unpaid',
  'customer_recommendation',
  'case_investigate',
  'decision_explain',
  'analytics_trend',
])

const TOOL_LABELS: Record<string, string> = {
  kb_get: 'Product knowledge',
  resolve_customer: 'Customer identity',
  get_customer_bundle: 'Customer history',
  get_payment_status_metrics: 'Payment / overdue metrics',
  get_risk_summary: 'Portfolio risk',
  get_recovery_metrics: 'Recovery outcomes',
  get_system_health: 'System health',
  search_cases: 'Case queue',
  get_case: 'Case status',
  get_case_explanation: 'Case explanation',
  get_policy: 'Policy rules',
  get_decision: 'Decision record',
  get_execution_history: 'Execution history',
  get_ledger: 'Ledger',
  get_review_queue: 'Review queue',
  get_forecast_summary: 'Forecast models',
  get_case_forecast: 'Case forecast',
  get_customer_forecast: 'Customer forecast',
  get_analytics_trend: 'Analytics trends',
  get_root_causes: 'Root-cause signals',
  get_risk_heatmap: 'Risk heatmap',
  compare_actions: 'Action comparison',
}

const ANALYZING_STEPS = [
  'Understanding your question',
  'Querying Revive data',
  'Building evidence',
  'Preparing answer',
]

type ThreadMessage =
  | { role: 'user'; text: string; id: string }
  | { role: 'assistant'; text: string; id: string; payload: ChatTurnResponse }

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function formatConvTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function groupConversations(items: ConversationSummary[]) {
  const today = startOfDay(new Date())
  const yesterday = today - 86_400_000
  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const c of items) {
    const t = startOfDay(new Date(c.updated_at))
    if (t >= today) groups[0].items.push(c)
    else if (t >= yesterday) groups[1].items.push(c)
    else groups[2].items.push(c)
  }
  return groups.filter((g) => g.items.length > 0)
}

function linkifyAnswer(md: string) {
  const lines = md.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|RISK-\d+)/g).filter(Boolean)
    return (
      <p key={i} className={line.startsWith('- ') || /^\d+\./.test(line) ? 'chat-md-line' : undefined}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={j}>{p.slice(2, -2)}</strong>
          }
          if (p.startsWith('`') && p.endsWith('`')) {
            return <code key={j}>{p.slice(1, -1)}</code>
          }
          if (/^RISK-\d+$/.test(p)) {
            return (
              <Link key={j} className="row-link" to={`/cases/${p}`}>
                {p}
              </Link>
            )
          }
          return <span key={j}>{p}</span>
        })}
      </p>
    )
  })
}

function toolDisplayName(name: string) {
  return TOOL_LABELS[name] || name.replace(/_/g, ' ')
}

function isDeterministicIntent(intent: string) {
  return (
    intent === 'portfolio_kpi' ||
    intent === 'payment_status' ||
    intent === 'overdue_status' ||
    intent === 'knowledge' ||
    intent === 'system_health' ||
    intent.startsWith('forecast')
  )
}

function BlockView({ block }: { block: ChatBlock }) {
  if (block.type === 'disclaimer' && block.text) {
    return <p className="chat-disclaimer">{block.text}</p>
  }
  if (block.type === 'metric_row' && block.metrics?.length) {
    return (
      <div className="chat-metric-row">
        {block.metrics.slice(0, 6).map((m) => (
          <div key={m.label} className="chat-metric-chip">
            <span className="chat-metric-label">{m.label}</span>
            <span className="chat-metric-value">{m.value}</span>
          </div>
        ))}
      </div>
    )
  }
  if (block.type === 'table' && block.columns && block.rows) {
    return (
      <div className="table-wrap chat-table">
        {block.title ? <div className="chat-block-title">{block.title}</div> : null}
        <table className="data">
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    {j === 0 && String(cell).startsWith('RISK-') ? (
                      <Link className="row-link" to={`/cases/${cell}`}>
                        {cell}
                      </Link>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.type === 'case_card' && block.case_id) {
    return (
      <div className="chat-case-card">
        <div className="chat-case-card-body">
          <span className="chat-case-card-label">Case</span>
          <strong>{block.title || block.case_id}</strong>
        </div>
        <Link className="chat-nav-btn" to={`/cases/${block.case_id}`}>
          View case →
        </Link>
      </div>
    )
  }
  if (block.type === 'text' && block.text) {
    return <div className="chat-block-text">{linkifyAnswer(block.text)}</div>
  }
  return null
}

function AnalyzingIndicator() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, ANALYZING_STEPS.length - 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="chat-bubble assistant pending intel-analyzing">
      <div className="chat-role">Revive IQ</div>
      <ul className="intel-analyze-steps">
        {ANALYZING_STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'done' : i === step ? 'active' : ''}>
            <span className="intel-analyze-dot" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function IntelligencePage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeCategory, setActiveCategory] = useState<PromptCategoryId | null>(null)
  const [overview, setOverview] = useState<DashboardSummary | null>(null)
  const [overviewAt, setOverviewAt] = useState<Date | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const refreshList = useCallback(async () => {
    const data = await chatApi.listConversations()
    setConversations(data.items || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [,] = await Promise.all([
          refreshList(),
          dashboardApi
            .summary()
            .then((s) => {
              if (!cancelled) {
                setOverview(s)
                setOverviewAt(new Date())
              }
            })
            .catch(() => undefined),
        ])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chats')
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshList])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, busy])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  const grouped = useMemo(() => groupConversations(conversations), [conversations])
  const selectedCategory = CATEGORIES.find((c) => c.id === activeCategory) || null

  const freshnessLabel = useMemo(() => {
    if (!overviewAt) return null
    const mins = Math.max(0, Math.round((Date.now() - overviewAt.getTime()) / 60_000))
    if (mins <= 1) return 'Updated just now'
    return `Updated ${mins} min ago`
  }, [overviewAt, thread.length, busy])

  async function ensureConversation(): Promise<string> {
    if (activeId) return activeId
    const created = await chatApi.createConversation()
    setActiveId(created.conversation_id)
    await refreshList()
    return created.conversation_id
  }

  async function loadConversation(id: string) {
    setError(null)
    setBusy(true)
    try {
      const detail = await chatApi.getConversation(id)
      setActiveId(id)
      const msgs: ThreadMessage[] = []
      for (const m of detail.messages || []) {
        if (m.role === 'user') {
          msgs.push({ role: 'user', text: m.text, id: m.message_id })
        } else {
          msgs.push({
            role: 'assistant',
            text: m.text,
            id: m.message_id,
            payload: (m.payload as ChatTurnResponse) || {
              conversation_id: id,
              message_id: m.message_id,
              intent: 'clarify',
              answer: { markdown: m.text, summary: '' },
              facts: [],
              citations: [],
              blocks: [],
              suggested_followups: [],
              ui_actions: [],
              confidence: 'medium',
              refusals: [],
              tools_used: [],
              provider: 'stub',
            },
          })
        }
      }
      setThread(msgs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open conversation')
    } finally {
      setBusy(false)
    }
  }

  async function startNew() {
    setError(null)
    setRenamingId(null)
    setActiveCategory(null)
    try {
      const created = await chatApi.createConversation()
      setActiveId(created.conversation_id)
      setThread([])
      await refreshList()
      inputRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create conversation')
    }
  }

  function beginRename(c: ConversationSummary, e: MouseEvent) {
    e.stopPropagation()
    setRenamingId(c.conversation_id)
    setRenameValue(c.title)
  }

  async function commitRename(id: string) {
    const title = renameValue.trim()
    if (!title) {
      setRenamingId(null)
      return
    }
    try {
      await chatApi.renameConversation(id, title)
      setRenamingId(null)
      await refreshList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename chat')
    }
  }

  function requestDelete(c: ConversationSummary, e: MouseEvent) {
    e.stopPropagation()
    setDeleteTarget({ id: c.conversation_id, title: c.title })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleting(true)
    setError(null)
    try {
      await chatApi.deleteConversation(id)
      if (renamingId === id) setRenamingId(null)
      if (activeId === id) {
        setActiveId(null)
        setThread([])
      }
      setDeleteTarget(null)
      await refreshList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat')
    } finally {
      setDeleting(false)
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setError(null)
    setBusy(true)
    setInput('')
    setActiveCategory(null)
    const tempId = `local-${Date.now()}`
    setThread((t) => [...t, { role: 'user', text: trimmed, id: tempId }])
    try {
      const id = await ensureConversation()
      const turn = await chatApi.sendMessage(id, trimmed)
      setActiveId(id)
      setThread((t) => [
        ...t,
        {
          role: 'assistant',
          text: turn.answer?.markdown || '',
          id: turn.message_id,
          payload: turn,
        },
      ])
      await refreshList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  if (bootstrapping) return <Loading label="Revive IQ" />

  return (
    <div className="intel-layout">
      <aside className="intel-sidebar">
        <div className="intel-sidebar-head">
          <h2>Conversations</h2>
          <button type="button" className="primary intel-new-chat" onClick={() => void startNew()}>
            + New chat
          </button>
        </div>
        <div className="intel-conv-scroll">
          {conversations.length === 0 && (
            <p className="empty-hint intel-sidebar-empty">No conversations yet.</p>
          )}
          {grouped.map((group) => (
            <div key={group.label} className="intel-conv-group">
              <div className="intel-conv-group-label">{group.label}</div>
              <ul className="intel-conv-list">
                {group.items.map((c) => (
                  <li
                    key={c.conversation_id}
                    className={
                      c.conversation_id === activeId
                        ? 'intel-conv-row active-row'
                        : 'intel-conv-row'
                    }
                  >
                    {renamingId === c.conversation_id ? (
                      <div
                        className="intel-conv-item"
                        style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem' }}
                      >
                        <input
                          ref={renameInputRef}
                          className="intel-rename-input"
                          value={renameValue}
                          aria-label="Rename conversation"
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => void commitRename(c.conversation_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void commitRename(c.conversation_id)
                            }
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={
                          c.conversation_id === activeId
                            ? 'intel-conv-item active'
                            : 'intel-conv-item'
                        }
                        onClick={() => void loadConversation(c.conversation_id)}
                      >
                        <span className="intel-conv-title">{c.title}</span>
                        <span className="intel-conv-meta">{formatConvTime(c.updated_at)}</span>
                      </button>
                    )}
                    <div className="intel-conv-actions">
                      <button
                        type="button"
                        className="intel-icon-btn"
                        title="Rename"
                        aria-label={`Rename ${c.title}`}
                        onClick={(e) => beginRename(c, e)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="intel-icon-btn danger"
                        title="Delete"
                        aria-label={`Delete ${c.title}`}
                        onClick={(e) => requestDelete(c, e)}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <section className="intel-main">
        <div className="page-head intel-head">
          <div className="intel-brand-row">
            <span className="intel-mark" aria-hidden="true">
              ✦
            </span>
            <div>
              <h1>Revive IQ</h1>
              <p className="intel-eyebrow">AI business intelligence</p>
            </div>
          </div>
          <div className="intel-live-chip" title="Answers grounded in Revive APIs">
            <span className="intel-live-dot" aria-hidden="true" />
            Live data
            {freshnessLabel ? <span className="intel-freshness">· {freshnessLabel}</span> : null}
          </div>
        </div>

        {error && <p className="chat-error">{error}</p>}

        <div className="intel-thread">
          {thread.length === 0 && (
            <div className="intel-empty">
              <div className="intel-hero">
                <span className="intel-hero-mark" aria-hidden="true">
                  ✦
                </span>
                <h2 className="intel-hero-title">Revive IQ</h2>
                <p className="intel-hero-tagline">Your intelligent revenue command center</p>
                <p className="intel-hero-sub">
                  Ask anything about your business, customers, receivables, risk, recovery, or
                  forecasts — answers include evidence from Revive.
                </p>
              </div>

              {overview && (
                <div className="intel-overview-card" aria-label="Business overview">
                  <div className="intel-overview-label">📊 Business Overview</div>
                  <div className="intel-overview-metrics">
                    <div>
                      <span className="intel-overview-value">
                        {formatINR(overview.revenue_at_risk_universe)}
                      </span>
                      <span className="intel-overview-k">At risk</span>
                    </div>
                    <div>
                      <span className="intel-overview-value">{overview.active_cases}</span>
                      <span className="intel-overview-k">Active cases</span>
                    </div>
                    <div>
                      <span className="intel-overview-value">{overview.closed_cases}</span>
                      <span className="intel-overview-k">Recovered / closed</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="intel-cat-grid" role="list">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="listitem"
                    className={
                      activeCategory === cat.id
                        ? 'intel-cat-tile active'
                        : 'intel-cat-tile'
                    }
                    disabled={busy}
                    onClick={() =>
                      setActiveCategory((prev) => (prev === cat.id ? null : cat.id))
                    }
                  >
                    <span className="intel-cat-icon" aria-hidden="true">
                      {cat.icon}
                    </span>
                    <span className="intel-cat-label">{cat.label}</span>
                    <span className="intel-cat-blurb">{cat.blurb}</span>
                  </button>
                ))}
              </div>

              {selectedCategory && (
                <div className="intel-cat-prompts">
                  <p className="intel-section-label">
                    {selectedCategory.icon} {selectedCategory.label}
                  </p>
                  <div className="intel-starters">
                    {selectedCategory.prompts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="intel-starter"
                        disabled={busy}
                        onClick={() => void send(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!selectedCategory && (
                <div className="intel-featured">
                  <p className="intel-section-label">Try asking</p>
                  <div className="intel-starters">
                    {FEATURED_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="intel-starter"
                        disabled={busy}
                        onClick={() => void send(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="intel-quick">
                <p className="intel-section-label">Quick actions</p>
                <div className="intel-quick-row">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className="intel-quick-btn"
                      disabled={busy}
                      onClick={() => void send(a.prompt)}
                    >
                      <span aria-hidden="true">{a.icon}</span> {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {thread.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="chat-bubble user">
                <div className="chat-role">You</div>
                <div className="chat-body">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="chat-bubble assistant">
                <div className="chat-role">
                  Revive IQ
                  {m.payload.confidence === 'refused' ? (
                    <span className="chat-pill warn">Refused</span>
                  ) : (
                    <span className="chat-pill">{m.payload.intent.replace(/_/g, ' ')}</span>
                  )}
                  {!isDeterministicIntent(m.payload.intent) &&
                    DIAGNOSTIC_INTENTS.has(m.payload.intent) &&
                    m.payload.confidence !== 'refused' && (
                      <span className={`chat-pill conf-${m.payload.confidence}`}>
                        Diagnosis: {m.payload.confidence}
                      </span>
                    )}
                </div>

                <div className="chat-body">{linkifyAnswer(m.payload.answer.markdown)}</div>

                {m.payload.blocks?.map((b, i) => (
                  <BlockView key={`${m.id}-b-${i}`} block={b} />
                ))}

                {m.payload.facts?.length > 0 && (
                  <div className="chat-facts">
                    <div className="chat-facts-label">Evidence</div>
                    <ul className="chat-evidence-list">
                      {m.payload.facts.map((f) => (
                        <li key={f.label}>
                          <span className="chat-fact-k">{f.label}</span>
                          <span className="chat-fact-v financial-figure">{f.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.payload.tools_used?.length > 0 && (
                  <div className="chat-analyzed">
                    <div className="chat-facts-label">Analyzed</div>
                    <ul className="intel-analyzed-list">
                      {m.payload.tools_used.map((t) => (
                        <li key={t}>
                          <span className="intel-check" aria-hidden="true">
                            ✓
                          </span>
                          {toolDisplayName(t)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.payload.analysis && (
                  <div className="chat-analysis">
                    <div className="chat-facts-label">Conclusion</div>
                    <p>{m.payload.analysis}</p>
                  </div>
                )}

                {m.payload.citations?.length > 0 && (
                  <div className="chat-citations">
                    <div className="chat-facts-label">Sources</div>
                    <ul>
                      {m.payload.citations.map((c, i) => (
                        <li key={i}>
                          <strong>{c.label}</strong>
                          <span className="text-muted"> · {c.source}</span>
                          {c.case_id ? (
                            <>
                              {' '}
                              ·{' '}
                              <Link className="row-link" to={`/cases/${c.case_id}`}>
                                {c.case_id}
                              </Link>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <p className="intel-source-fresh">
                      <span className="intel-live-dot" aria-hidden="true" />
                      Grounded in Revive APIs
                      {freshnessLabel ? ` · ${freshnessLabel}` : ''}
                    </p>
                  </div>
                )}

                {m.payload.ui_actions?.length > 0 && (
                  <div className="chat-ui-actions">
                    {m.payload.ui_actions.map((a) => (
                      <Link key={a.href + a.label} className="chat-nav-btn" to={a.href}>
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}

                {m.payload.suggested_followups?.length > 0 && (
                  <div className="intel-followups">
                    <div className="chat-facts-label">You may also want to know</div>
                    <div className="intel-starters compact">
                      {m.payload.suggested_followups.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="intel-starter"
                          disabled={busy}
                          onClick={() => void send(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          )}

          {busy && <AnalyzingIndicator />}
          <div ref={bottomRef} />
        </div>

        <div className="intel-composer-wrap">
          {thread.length > 0 && (
            <div className="intel-quick-inline">
              {QUICK_ACTIONS.slice(0, 4).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="intel-quick-btn sm"
                  disabled={busy}
                  onClick={() => void send(a.prompt)}
                >
                  <span aria-hidden="true">{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          )}
          <form className="intel-composer" onSubmit={onSubmit}>
            <div className="intel-composer-box">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                placeholder="Ask Revive IQ anything about your business…"
                aria-label="Ask Revive IQ"
                disabled={busy}
              />
              <div className="intel-composer-tools">
                <button
                  type="button"
                  className="intel-tool-btn"
                  disabled
                  title="Attachments coming soon"
                  aria-label="Attach (coming soon)"
                >
                  📎
                </button>
                <button
                  type="submit"
                  className="primary intel-send-btn"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  title="Send"
                >
                  ➤
                </button>
              </div>
            </div>
          </form>
          <p className="intel-composer-hint">
            Receivables · Customers · Risk · Recovery · Forecasts · Enter to send
          </p>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete conversation"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
    </div>
  )
}
