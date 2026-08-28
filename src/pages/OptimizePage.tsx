import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { strategyLabApi } from '../api/strategyLab'
import { formatINR } from '../utils/format'
import { Loading } from '../components/ui'

export function OptimizePage() {
  const baseline = useAsync(() => strategyLabApi.baseline(), [])

  const openCases = baseline.data?.open_cases
  const atRisk = baseline.data?.revenue_at_risk

  return (
    <div className="optimize-page">
      <div className="page-head">
        <div>
          <h1>Optimize</h1>
          <p>
            Improve how you recover tomorrow — without executing anything today. Pick the
            unit of analysis that matches your question.
          </p>
        </div>
      </div>

      {baseline.loading && <Loading size="sm" label="Portfolio snapshot" />}

      <div className="optimize-grid">
        <Link to="/strategy-lab" className="optimize-card">
          <span className="optimize-card-kicker">Portfolio · many cases</span>
          <h2>Recovery Strategy Lab</h2>
          <p>
            Design portfolio-wide recovery strategies and estimate their revenue impact.
            Configure policy knobs, simulate cohorts, compare, then approve — never silent
            execution.
          </p>
          <p className="optimize-card-question">
            “What recovery strategy should I use across my business?”
          </p>
          <div className="optimize-card-meta">
            {openCases != null && atRisk != null ? (
              <span>
                {openCases} open cases · {formatINR(atRisk)} at risk
              </span>
            ) : (
              <span>Portfolio strategy what-if</span>
            )}
            <span className="optimize-card-cta">Open Strategy Lab →</span>
          </div>
        </Link>

        <Link to="/simulator" className="optimize-card">
          <span className="optimize-card-kicker">Case · one receivable</span>
          <h2>Case Simulator</h2>
          <p>
            Test different actions for an individual recovery case before execution. Compare
            expected recovery across reminders, repairs, escalations, and more.
          </p>
          <p className="optimize-card-question">
            “What should I do for this specific case?”
          </p>
          <div className="optimize-card-meta">
            <span>Compare actions · Monte Carlo outcomes</span>
            <span className="optimize-card-cta">Open Simulator →</span>
          </div>
        </Link>
      </div>
    </div>
  )
}
