import { Badge } from '../components/ui'

const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  CLOSED: 'ok',
  RECOVERED: 'ok',
  FULL_RECOVERY: 'ok',
  SUCCESS: 'ok',
  APPROVED: 'ok',
  PARTIAL_RECOVERY: 'warn',
  NEXT_ACTION_PROPOSED: 'info',
  OUTCOME_MONITORING: 'info',
  HOLD_FOR_PROMISE: 'info',
  ESCALATED: 'warn',
  HUMAN_REVIEW: 'warn',
  ABORTED: 'bad',
  FAILED: 'bad',
  BLOCKED: 'bad',
  ACTIVE: 'info',
}

export function statusTone(status: string | null | undefined) {
  if (!status) return 'neutral' as const
  return TONE[status] || 'neutral'
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>
  return <Badge tone={statusTone(status)}>{status}</Badge>
}
