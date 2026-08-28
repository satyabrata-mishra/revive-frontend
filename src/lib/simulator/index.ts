export { RECOVERY_ACTIONS, STRATEGY_PRESETS, ACTION_BY_ID, isRecoveryAction } from './actions'
export type { RecoveryActionId, ActionCharacteristics } from './actions'
export {
  caseStateFromUnified,
  caseStateFromSummary,
  actionPriorsFromComparison,
} from './caseState'
export type { SimulatorCaseState } from './caseState'
export { validateStrategy, scheduleStepDays, countContactSteps } from './constraints'
export type { StrategyStepInput, StrategyValidation, ConstraintStatus } from './constraints'
export {
  runSimulation,
  recommendStrategy,
  scoreForObjective,
} from './engine'
export type {
  SimulateRequest,
  SimulationResult,
  SimulationParameters,
  OptimizationObjective,
  RiskBand,
  ConfidenceBand,
} from './engine'
export { defaultSeed } from './rng'
