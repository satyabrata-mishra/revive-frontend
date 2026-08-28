import { ACTION_BY_ID, type RecoveryActionId } from './actions'
import type { SimulatorCaseState } from './caseState'

export type ConstraintStatus = 'allowed' | 'blocked' | 'requires_human_approval'

export interface StepConstraint {
  action: string
  status: ConstraintStatus
  reasons: string[]
}

export interface StrategyValidation {
  valid: boolean
  steps: StepConstraint[]
  global_reasons: string[]
}

export interface StrategyStepInput {
  action: string
  delay_days: number
}

export function scheduleStepDays(steps: StrategyStepInput[]): number[] {
  let day = 0
  return steps.map((step) => {
    day += Math.max(0, step.delay_days)
    return day
  })
}

export function countContactSteps(steps: StrategyStepInput[]): number {
  return steps.reduce((n, step) => {
    const catalog = ACTION_BY_ID[step.action]
    return n + (catalog?.contact ? 1 : 0)
  }, 0)
}

export function validateStrategy(
  caseState: SimulatorCaseState,
  steps: StrategyStepInput[],
  overrides?: { max_contacts?: number; recovery_window_days?: number },
): StrategyValidation {
  const maxContacts = overrides?.max_contacts ?? caseState.max_contacts
  const windowDays = overrides?.recovery_window_days ?? caseState.recovery_window_days
  const global: string[] = []
  const stepResults: StepConstraint[] = []

  if (!steps.length) {
    return {
      valid: false,
      steps: [],
      global_reasons: ['Strategy must include at least one action.'],
    }
  }

  if (windowDays <= 0) {
    global.push('Recovery window has expired — strategy is invalid.')
  }

  let contacts = caseState.contacts_used
  const days = scheduleStepDays(steps)

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const reasons: string[] = []
    let status: ConstraintStatus = 'allowed'
    const catalog = ACTION_BY_ID[step.action]
    const day = days[i]

    if (!catalog) {
      reasons.push(`Unknown action: ${step.action}`)
      status = 'blocked'
    } else {
      if (day > windowDays) {
        reasons.push(`Action falls outside recovery window (day ${day} > ${windowDays}).`)
        status = 'blocked'
      }
      if (catalog.contact) {
        contacts += 1
        if (contacts > maxContacts) {
          reasons.push(`Maximum contacts (${maxContacts}) would be exceeded.`)
          status = 'blocked'
        }
      }
      if (catalog.blockedOnOptOut && caseState.customer_opt_out) {
        reasons.push('Customer opted out of contact.')
        status = 'blocked'
      }
      if (catalog.blockedOnDispute && caseState.active_dispute) {
        reasons.push('Active dispute blocks this automated contact.')
        status = 'blocked'
      }
      if (catalog.requiresHuman || caseState.human_approval_required) {
        if (status === 'allowed') status = 'requires_human_approval'
        reasons.push('Human approval required before real execution (simulation still allowed).')
      }
    }

    stepResults.push({ action: step.action, status, reasons })
  }

  const hasBlocked = stepResults.some((s) => s.status === 'blocked')
  return {
    valid: !hasBlocked && global.length === 0,
    steps: stepResults,
    global_reasons: global,
  }
}

export function assertKnownActions(steps: StrategyStepInput[]): RecoveryActionId[] {
  return steps.map((s) => {
    if (!ACTION_BY_ID[s.action]) throw new Error(`Invalid action: ${s.action}`)
    return s.action as RecoveryActionId
  })
}
