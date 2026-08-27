import { Badge } from '../components/ui'
import { formatStatusLabel } from '../utils/lifecycle'

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  CLOSED: 'ok',
  RECOVERED: 'ok',
  FULL_RECOVERY: 'ok',
  SUCCESS: 'ok',
  APPROVED: 'ok',
  POLICY_VALIDATED: 'ok',
  PARTIAL_RECOVERY: 'warn',
  NEXT_ACTION_PROPOSED: 'info',
  OUTCOME_MONITORING: 'info',
  HOLD_FOR_PROMISE: 'info',
  DETECTED: 'info',
  ESCALATED: 'warn',
  HUMAN_REVIEW: 'warn',
  PENDING: 'warn',
  ABORTED: 'bad',
  FAILED: 'bad',
  BLOCKED: 'bad',
  REJECTED: 'bad',
  ACTIVE: 'info',
  P1: 'bad',
  P2: 'warn',
  P3: 'info',
  P4: 'neutral',
  MODIFIED: 'warn',
}

export function statusTone(status: string | null | undefined) {
  if (!status) return 'neutral' as const
  return TONE[status] || 'neutral'
}

export function StatusBadge({
  status,
  raw = false,
}: {
  status: string | null | undefined
  /** When true, show the backend enum instead of the human label. */
  raw?: boolean
}) {
  if (!status) return <Badge>—</Badge>
  const label = raw || /^P[1-4]$/.test(status) ? status : formatStatusLabel(status)
  return (
    <Badge tone={statusTone(status)} title={status}>
      {label}
    </Badge>
  )
}
