import { Badge } from '../components/ui'

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
}

export function statusTone(status: string | null | undefined) {
  if (!status) return 'neutral' as const
  return TONE[status] || 'neutral'
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>—</Badge>
  return <Badge tone={statusTone(status)}>{status}</Badge>
}
