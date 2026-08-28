/** Extensible recovery-action catalog for the Recovery Simulator. */

export type RecoveryActionId =
  | 'NO_ACTION'
  | 'SEND_REMINDER'
  | 'SEND_PAYMENT_LINK'
  | 'REQUEST_PROMISE_TO_PAY'
  | 'FOLLOW_UP_PROMISE'
  | 'CORRECT_AND_RESEND_INVOICE'
  | 'REQUEST_PO'
  | 'ESCALATE_TO_HUMAN'
  | 'ESCALATE_TO_ACCOUNT_MANAGER'

export interface ActionCharacteristics {
  id: RecoveryActionId
  label: string
  /** Base mutually exclusive outcome probs (full / partial / none). */
  pFull: number
  pPartial: number
  pNone: number
  /** Fraction of outstanding recovered on partial success. */
  partialFraction: number
  actionCost: number
  relationshipPenalty: number
  expectedDays: number
  contact: boolean
  requiresHuman: boolean
  blockedOnDispute: boolean
  blockedOnOptOut: boolean
}

export const RECOVERY_ACTIONS: ActionCharacteristics[] = [
  {
    id: 'NO_ACTION',
    label: 'No action',
    pFull: 0.08,
    pPartial: 0.12,
    pNone: 0.8,
    partialFraction: 0.25,
    actionCost: 0,
    relationshipPenalty: 0,
    expectedDays: 14,
    contact: false,
    requiresHuman: false,
    blockedOnDispute: false,
    blockedOnOptOut: false,
  },
  {
    id: 'SEND_REMINDER',
    label: 'Send reminder',
    pFull: 0.28,
    pPartial: 0.22,
    pNone: 0.5,
    partialFraction: 0.35,
    actionCost: 120,
    relationshipPenalty: 400,
    expectedDays: 3,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: true,
    blockedOnOptOut: true,
  },
  {
    id: 'SEND_PAYMENT_LINK',
    label: 'Send payment link',
    pFull: 0.36,
    pPartial: 0.24,
    pNone: 0.4,
    partialFraction: 0.4,
    actionCost: 180,
    relationshipPenalty: 600,
    expectedDays: 2.5,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: true,
    blockedOnOptOut: true,
  },
  {
    id: 'REQUEST_PROMISE_TO_PAY',
    label: 'Request promise to pay',
    pFull: 0.32,
    pPartial: 0.28,
    pNone: 0.4,
    partialFraction: 0.45,
    actionCost: 200,
    relationshipPenalty: 500,
    expectedDays: 5,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: true,
    blockedOnOptOut: true,
  },
  {
    id: 'FOLLOW_UP_PROMISE',
    label: 'Follow up promise',
    pFull: 0.4,
    pPartial: 0.25,
    pNone: 0.35,
    partialFraction: 0.5,
    actionCost: 150,
    relationshipPenalty: 700,
    expectedDays: 3,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: true,
    blockedOnOptOut: true,
  },
  {
    id: 'CORRECT_AND_RESEND_INVOICE',
    label: 'Correct and resend invoice',
    pFull: 0.55,
    pPartial: 0.2,
    pNone: 0.25,
    partialFraction: 0.55,
    actionCost: 350,
    relationshipPenalty: 200,
    expectedDays: 4,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: false,
    blockedOnOptOut: true,
  },
  {
    id: 'REQUEST_PO',
    label: 'Request PO',
    pFull: 0.48,
    pPartial: 0.22,
    pNone: 0.3,
    partialFraction: 0.5,
    actionCost: 280,
    relationshipPenalty: 150,
    expectedDays: 6,
    contact: true,
    requiresHuman: false,
    blockedOnDispute: false,
    blockedOnOptOut: true,
  },
  {
    id: 'ESCALATE_TO_HUMAN',
    label: 'Escalate to human',
    pFull: 0.42,
    pPartial: 0.28,
    pNone: 0.3,
    partialFraction: 0.55,
    actionCost: 2500,
    relationshipPenalty: 1200,
    expectedDays: 7,
    contact: false,
    requiresHuman: true,
    blockedOnDispute: false,
    blockedOnOptOut: false,
  },
  {
    id: 'ESCALATE_TO_ACCOUNT_MANAGER',
    label: 'Escalate to account manager',
    pFull: 0.5,
    pPartial: 0.25,
    pNone: 0.25,
    partialFraction: 0.6,
    actionCost: 4000,
    relationshipPenalty: 1800,
    expectedDays: 5,
    contact: false,
    requiresHuman: true,
    blockedOnDispute: false,
    blockedOnOptOut: false,
  },
]

export const ACTION_BY_ID: Record<string, ActionCharacteristics> = Object.fromEntries(
  RECOVERY_ACTIONS.map((a) => [a.id, a]),
)

export function isRecoveryAction(id: string): id is RecoveryActionId {
  return id in ACTION_BY_ID
}

export const STRATEGY_PRESETS: {
  id: string
  name: string
  description: string
  steps: { action: RecoveryActionId; delay_days: number }[]
}[] = [
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Reminder → payment link → account manager',
    steps: [
      { action: 'SEND_REMINDER', delay_days: 0 },
      { action: 'SEND_PAYMENT_LINK', delay_days: 2 },
      { action: 'ESCALATE_TO_ACCOUNT_MANAGER', delay_days: 3 },
    ],
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Reminder → promise → account manager',
    steps: [
      { action: 'SEND_REMINDER', delay_days: 0 },
      { action: 'REQUEST_PROMISE_TO_PAY', delay_days: 3 },
      { action: 'ESCALATE_TO_ACCOUNT_MANAGER', delay_days: 4 },
    ],
  },
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Human review → account manager',
    steps: [
      { action: 'ESCALATE_TO_HUMAN', delay_days: 0 },
      { action: 'ESCALATE_TO_ACCOUNT_MANAGER', delay_days: 5 },
    ],
  },
]
