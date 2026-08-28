import { casesApi } from './cases'
import { simulationApi } from './forecast'
import type { CaseSummary, Paginated } from './types'
import {
  actionPriorsFromComparison,
  caseStateFromSummary,
  caseStateFromUnified,
  recommendStrategy,
  runSimulation,
  type OptimizationObjective,
  type SimulationParameters,
  type SimulationResult,
  type SimulatorCaseState,
  type StrategyStepInput,
} from '../lib/simulator'

const STORAGE_KEY = 'revive.simulator.history.v1'

export interface SimulatorScenarioRecord {
  simulation_id: string
  case_id: string
  scenario_name: string
  created_at: string
  result: SimulationResult
}

function readHistory(): SimulatorScenarioRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SimulatorScenarioRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeHistory(items: SimulatorScenarioRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)))
}

export const simulatorApi = {
  listCases: (q?: string, limit = 50): Promise<Paginated<CaseSummary>> =>
    q ? casesApi.search(q, limit) : casesApi.list({ limit }),

  getCaseState: async (caseId: string): Promise<SimulatorCaseState> => {
    try {
      const uc = await casesApi.get(caseId)
      return caseStateFromUnified(uc)
    } catch {
      const listed = await casesApi.list({ q: caseId, limit: 20 })
      const hit = listed.items.find((c) => c.case_id === caseId) || listed.items[0]
      if (!hit) throw new Error(`Case not found: ${caseId}`)
      return caseStateFromSummary(hit)
    }
  },

  simulate: async (input: {
    case_id: string
    strategy: StrategyStepInput[]
    scenario_name?: string
    scenario_description?: string
    parameters?: SimulationParameters
    objective?: OptimizationObjective
    case_state?: SimulatorCaseState
  }): Promise<SimulationResult> => {
    const case_state =
      input.case_state || (await simulatorApi.getCaseState(input.case_id))

    let action_priors: SimulatePriors | undefined
    try {
      const comparison = await simulationApi.actionComparison(input.case_id)
      action_priors = actionPriorsFromComparison(comparison)
    } catch {
      action_priors = undefined
    }

    return runSimulation({
      case_id: input.case_id,
      case_state,
      strategy: input.strategy,
      scenario_name: input.scenario_name,
      scenario_description: input.scenario_description,
      parameters: input.parameters,
      action_priors,
      objective: input.objective,
    })
  },

  saveScenario: (result: SimulationResult): SimulatorScenarioRecord => {
    const record: SimulatorScenarioRecord = {
      simulation_id: result.simulation_id,
      case_id: result.case_id,
      scenario_name: result.scenario_name,
      created_at: result.created_at,
      result,
    }
    const history = readHistory().filter((h) => h.simulation_id !== record.simulation_id)
    history.unshift(record)
    writeHistory(history)
    return record
  },

  listHistory: (caseId?: string): SimulatorScenarioRecord[] => {
    const all = readHistory()
    return caseId ? all.filter((h) => h.case_id === caseId) : all
  },

  getScenario: (simulationId: string): SimulatorScenarioRecord | null =>
    readHistory().find((h) => h.simulation_id === simulationId) || null,

  deleteScenario: (simulationId: string) => {
    writeHistory(readHistory().filter((h) => h.simulation_id !== simulationId))
  },

  compare: (
    results: SimulationResult[],
    objective: OptimizationObjective = 'max_net',
  ): {
    rows: SimulationResult[]
    recommendation: { winner: SimulationResult; reason: string } | null
  } => {
    const recommendation = recommendStrategy(results, objective)
    const marked = results.map((r) => ({
      ...r,
      recommended: recommendation?.winner.simulation_id === r.simulation_id,
    }))
    return { rows: marked, recommendation }
  },
}

type SimulatePriors = NonNullable<
  Parameters<typeof runSimulation>[0]['action_priors']
>
