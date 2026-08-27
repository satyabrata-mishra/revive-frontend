/** Shared lifecycle / decision vocabulary for Ops UI coherence. */

export type WorkNextAction = {
  label: string
  kind: 'human' | 'execute' | 'monitor' | 'done' | 'blocked' | 'review'
}

/** Human-readable labels for backend status / decision enums. */
const STATUS_LABELS: Record<string, string> = {
  CLOSED: 'Closed',
  RECOVERED: 'Recovered',
  FULL_RECOVERY: 'Full recovery',
  PARTIAL_RECOVERY: 'Partial recovery',
  SUCCESS: 'Succeeded',
  APPROVED: 'Approved',
  POLICY_VALIDATED: 'Policy validated',
  NEXT_ACTION_PROPOSED: 'Next action ready',
  OUTCOME_MONITORING: 'Awaiting outcome',
  HOLD_FOR_PROMISE: 'Hold for promise',
  DETECTED: 'Detected',
  ESCALATED: 'Escalated',
  HUMAN_REVIEW: 'Human approval required',
  PENDING: 'Pending review',
  ABORTED: 'Aborted',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
  REJECTED: 'Rejected',
  MODIFIED: 'Modified by policy',
  ACTIVE: 'Active',
  POLICY_HUMAN_REVIEW: 'Human approval required',
  REQUIRES_HUMAN_REVIEW: 'Human approval required',
}

const HUMAN_ACTIONS = new Set([
  'ESCALATE_TO_HUMAN',
  'ESCALATE_TO_ACCOUNT_MANAGER',
  'HUMAN_REVIEW',
])

export function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_LABELS[status] || status.replace(/_/g, ' ')
}

export function isHumanGateAction(action: string | null | undefined): boolean {
  return !!action && HUMAN_ACTIONS.has(action)
}

/**
 * Derive the operator-facing "next step" for work queues.
 * Prefers lifecycle state over raw recommended/authorized enums.
 */
export function nextWorkAction(input: {
  current_state?: string | null
  recommended_action?: string | null
  authorized_action?: string | null
  system_status?: string | null
}): WorkNextAction {
  const state = input.current_state || ''
  const recommended = input.recommended_action || null
  const authorized = input.authorized_action || null
  const action = authorized || recommended

  if (state === 'CLOSED' || state === 'RECOVERED') {
    return { label: 'Done', kind: 'done' }
  }
  if (state === 'OUTCOME_MONITORING') {
    return { label: 'Awaiting outcome', kind: 'monitor' }
  }
  if (state === 'ESCALATED' || state === 'HUMAN_REVIEW') {
    return { label: 'Human approval', kind: 'human' }
  }
  if (isHumanGateAction(action) || isHumanGateAction(recommended)) {
    return { label: 'Human approval', kind: 'human' }
  }
  if (state === 'NEXT_ACTION_PROPOSED' && action) {
    return { label: action.replace(/_/g, ' '), kind: 'execute' }
  }
  if (action) {
    return {
      label: action.replace(/_/g, ' '),
      kind: isHumanGateAction(action) ? 'human' : 'execute',
    }
  }
  return { label: 'Review case', kind: 'review' }
}

export function policyStageLabel(decision: string | null | undefined): string {
  switch (decision) {
    case 'APPROVED':
      return 'Autonomous execution allowed'
    case 'MODIFIED':
      return 'Policy modified the action'
    case 'HUMAN_REVIEW':
      return 'Human approval required'
    case 'BLOCKED':
      return 'Blocked by policy'
    default:
      return decision ? decision.replace(/_/g, ' ') : '—'
  }
}
