import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, forecastApi, simulationApi } from '../api'
import { Badge, ErrorState, Loading, MetricCard, Section } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatAction, formatINR, formatPct } from '../utils/format'

export function ForecastPage() {
  const [priority, setPriority] = useState('P1')
  const summary = useAsync(() => forecastApi.summary(), [])
  const trend = useAsync(() => analyticsApi.recoveryTrend(30), [])
  const velocity = useAsync(() => analyticsApi.recoveryVelocity(), [])
  const rootCauses = useAsync(() => analyticsApi.rootCauses(), [])
  const heatmap = useAsync(() => analyticsApi.riskHeatmap(), [])
  const portfolio = useAsync(
    () => simulationApi.portfolio({ priority, include_human_gated: true }),
    [priority],
  )

  const maxCum = useMemo(() => {
    const pts = trend.data?.points || []
    return Math.max(...pts.map((p) => p.amount_recovered_cumulative), 1)
  }, [trend.data])

  if (summary.loading) return <Loading label="Forecast" />
  if (summary.error) return <ErrorState message={summary.error} />
  if (!summary.data) return <ErrorState message="No forecast data" />

  const f = summary.data
  const m = velocity.data?.merchant

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Recovery Forecast</h1>
          <p>
            How much can Revive recover, and what should it do next? Figures are{' '}
            <strong>estimates</strong>, not guarantees.
          </p>
        </div>
      </div>

      <p className="forecast-disclaimer">{f.disclaimer}</p>

      <Section title="Recovery opportunity">
        <div className="forecast-opportunity">
          <div>
            <div className="metric-label">At risk</div>
            <div className="metric-value">{formatINR(f.current_ar_at_risk)}</div>
            <div className="muted-note">{f.open_cases} open receivables</div>
          </div>
          <div>
            <div className="metric-label">Expected recoverable (30-day)</div>
            <div className="metric-value">{formatINR(f.expected_30_day_recovery)}</div>
            <div className="muted-note">
              {f.current_ar_at_risk > 0
                ? `${Math.round((f.currently_actionable / f.current_ar_at_risk) * 100)}% of at-risk balance is currently actionable`
                : 'Actionable share unavailable'}
            </div>
          </div>
          <div className="forecast-opportunity-cta">
            <Link to="/cases" className="primary button-link">
              Review recovery opportunities →
            </Link>
            <Link to="/intelligence" className="button-link">
              Ask Revive IQ
            </Link>
          </div>
        </div>
        <div className="metric-grid" style={{ marginTop: '1rem' }}>
          <MetricCard
            label="Currently Actionable"
            value={formatINR(f.currently_actionable)}
            sub={`${f.actionable_cases} cases · estimate`}
          />
          <MetricCard
            label="Expected 7-day"
            value={formatINR(f.expected_7_day_recovery)}
            sub="Forecast"
          />
          <MetricCard
            label="Expected 14-day"
            value={formatINR(f.expected_14_day_recovery)}
            sub="Forecast"
          />
          <MetricCard
            label="Expected 30-day"
            value={formatINR(f.expected_30_day_recovery)}
            sub={
              Math.abs(f.expected_30_day_recovery - f.expected_14_day_recovery) < 1
                ? 'No additional recovery expected after Day 14'
                : 'Forecast'
            }
          />
          <MetricCard
            label="Expected unrecovered"
            value={formatINR(f.expected_unrecovered)}
            sub="Beyond recovery horizon"
          />
        </div>
        {Math.abs(f.expected_30_day_recovery - f.expected_14_day_recovery) < 1 && (
          <p className="muted-note" style={{ marginTop: '0.75rem' }}>
            14-day and 30-day expected recovery match because the model does not project
            additional recovery after Day 14 for this portfolio.
          </p>
        )}
      </Section>

      <div className="grid-2">
        <Section title="Portfolio What-If">
          <p className="muted-note">
            Simulation / counterfactual — not actual recovered revenue.
          </p>
          <div className="forecast-toolbar">
            <label>
              Priority{' '}
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="ALL">ALL</option>
              </select>
            </label>
          </div>
          {portfolio.loading && <Loading size="sm" label="Simulating" />}
          {portfolio.data && (
            <>
              <dl className="kv">
                <dt>Current cases</dt>
                <dd>{portfolio.data.current_cases}</dd>
                <dt>Revenue at risk</dt>
                <dd>{formatINR(portfolio.data.current_revenue_at_risk)}</dd>
                <dt>Potentially actionable</dt>
                <dd>{portfolio.data.potentially_actionable}</dd>
                <dt>Human-gated</dt>
                <dd>{portfolio.data.human_gated}</dd>
                <dt>Autonomous candidates</dt>
                <dd>{portfolio.data.autonomous_candidates}</dd>
                <dt>Expected recovery</dt>
                <dd>{formatINR(portfolio.data.expected_recovery)}</dd>
                <dt>Expected cost</dt>
                <dd>{formatINR(portfolio.data.expected_cost)}</dd>
                <dt>Expected net</dt>
                <dd>{formatINR(portfolio.data.expected_net_recovery)}</dd>
              </dl>
              <p className="muted-note" style={{ marginTop: '0.75rem' }}>
                {portfolio.data.disclaimer}
              </p>
            </>
          )}
        </Section>

        <Section title="Recovery Velocity">
          {velocity.loading && <Loading size="sm" label="Velocity" />}
          {m && (
            <div className="metric-grid">
              <MetricCard
                label="Avg recovery time"
                value={`${m.recovery_days.toFixed(1)} days`}
              />
              <MetricCard
                label="Avg recovered"
                value={formatINR(m.n_cases ? m.amount_recovered / m.n_cases : 0)}
              />
              <MetricCard
                label="Velocity"
                value={`${formatINR(m.velocity_per_day)}/day`}
                sub={`${m.n_cases} recovered cases`}
              />
            </div>
          )}
          {velocity.data?.by_action?.length ? (
            <>
              <h3 className="subhead">By action</h3>
              <ul className="compact-list">
                {velocity.data.by_action.slice(0, 5).map((b) => (
                  <li key={b.key}>
                    <span>{formatAction(b.key)}</span>
                    <strong>{formatINR(b.velocity_per_day)}/day</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Section>
      </div>

      <Section title="Recovery Trend">
        {trend.loading && <Loading size="sm" label="Trend" />}
        {trend.data?.points?.length ? (
          <>
            <div className="trend-chart" role="img" aria-label="Cumulative recovery trend">
              {trend.data.points.map((p) => (
                <div key={p.day} className="trend-col" title={p.date || `Day ${p.day}`}>
                  <div
                    className="trend-bar"
                    style={{
                      height: `${Math.max(
                        4,
                        (p.amount_recovered_cumulative / maxCum) * 100,
                      )}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="trend-axis">
              <span>Day 1</span>
              <span>Today · {formatINR(trend.data.total_recovered)} recovered</span>
            </div>
            <p className="muted-note">{trend.data.disclaimer}</p>
          </>
        ) : null}
      </Section>

      <div className="grid-2">
        <Section title="Why Money Is Stuck">
          {rootCauses.loading && <Loading size="sm" label="Root causes" />}
          {rootCauses.data?.causes?.length ? (
            <>
              <ul className="cause-bars">
                {rootCauses.data.causes.slice(0, 8).map((c) => (
                  <li key={c.root_cause}>
                    <div className="cause-bar-head">
                      <span>{c.label}</span>
                      <span>
                        {formatPct(c.share)} · {formatINR(c.outstanding)}
                      </span>
                    </div>
                    <div className="cause-bar-track">
                      <div
                        className="cause-bar-fill"
                        style={{ width: `${Math.max(2, c.share * 100)}%` }}
                      />
                    </div>
                    {c.recommended_action && (
                      <div className="cause-strategy">
                        → {formatAction(c.recommended_action)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="muted-note">{rootCauses.data.disclaimer}</p>
            </>
          ) : null}
        </Section>

        <Section title="Risk Heatmap">
          {heatmap.loading && <Loading size="sm" label="Heatmap" />}
          {heatmap.data && (
            <>
              <div className="heatmap-grid">
                {heatmap.data.cells.map((cell) => (
                  <div key={cell.quadrant} className={`heatmap-cell tone-${cell.tone}`}>
                    <div className="heatmap-label">{cell.label}</div>
                    <div className="heatmap-value">{formatINR(cell.outstanding)}</div>
                    <div className="heatmap-meta">{cell.n_cases} cases</div>
                    <p>{cell.description}</p>
                    {cell.case_ids[0] && (
                      <Link className="row-link" to={`/cases/${cell.case_ids[0]}`}>
                        Open sample →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p className="muted-note">{heatmap.data.disclaimer}</p>
            </>
          )}
        </Section>
      </div>

      <Section
        title="Act on the forecast"
        right={<Badge tone="info">Work queue</Badge>}
      >
        <p style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
          Open high-value cases, compare what-if actions, and approve policy-gated work.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/cases" className="row-link">
            Browse cases →
          </Link>
          <Link to="/review" className="row-link">
            Human review →
          </Link>
          <Link to="/intelligence" className="row-link">
            Ask Revive IQ →
          </Link>
        </div>
      </Section>
    </div>
  )
}
