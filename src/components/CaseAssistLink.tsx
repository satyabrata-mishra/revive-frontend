import { Link } from 'react-router-dom'

type Props = {
  caseId: string
  from?: 'review' | 'control-tower' | 'case'
  className?: string
  /** Compact inline variant for dense lists */
  dense?: boolean
}

/** Short entry to the case-scoped assist workspace (not a chatbot FAB). */
export function CaseAssistLink({ caseId, from, className = '', dense = false }: Props) {
  const q = from === 'review' ? '?from=review' : ''
  return (
    <Link
      to={`/cases/${caseId}/copilot${q}`}
      className={`case-assist-btn${dense ? ' is-dense' : ''} ${className}`.trim()}
      title="Case Assist — decide next action on this case"
    >
      <span className="case-assist-mark" aria-hidden="true" />
      <span className="case-assist-label">Case Assist</span>
    </Link>
  )
}
