import { Link } from 'react-router-dom'
import { warRoomApi } from '../api'
import { Badge, ErrorState, Loading } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { formatINR, formatAction } from '../utils/format'
import type { HealthTrend, WarRoomSeverity } from '../api/warRoom'

function sevTone(sev: WarRoomSeverity): 'bad' | 'warn' | 'info' | 'neutral' {
  if (sev === 'SEV-1') return 'bad'
  if (sev === 'SEV-2') return 'warn'
  if (sev === 'SEV-3') return 'info'
  return 'neutral'
}

function healthTone(t: HealthTrend): 'bad' | 'warn' | 'ok' | 'info' {
  if (t === 'CRITICAL' || t === 'HIGH') return 'bad'
  if (t === 'STABLE') return 'warn'
  if (t === 'IMPROVING' || t === 'RESOLVED') return 'ok'
  return 'info'
}

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function WarRoomPage() {
  const list = useAsync(() => warRoomApi.list(), [])

  return (
    <div className="wr-page">
      <div className="wr-board-head">
        <div>
          <p className="wr-kicker">Incident command</p>
          <h1>Recovery War Room</h1>
          <p className="wr-lede">
            Critical recovery situations — not another case queue. Correlate impact, decide
            together, and drive resolution.
          </p>
        </div>
      </div>

      {list.loading && <Loading label="Loading War Rooms…" />}
      {list.error && <ErrorState message={list.error} />}

      {list.data && !list.data.items.length && (
        <p className="wr-empty">No active recovery incidents.</p>
      )}

      {list.data && list.data.items.length > 0 && (
        <ul className="wr-board">
          {list.data.items.map((item) => (
            <li key={item.incident_id} className={`wr-board-card sev-${item.severity.toLowerCase()}`}>
              <div className="wr-board-card-top">
                <span className="wr-incident-id">{item.incident_id}</span>
                <div className="wr-board-badges">
                  <Badge tone={sevTone(item.severity)}>{item.severity}</Badge>
                  <Badge tone={healthTone(item.health_trend)}>{item.status.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <h2>{item.title}</h2>
              <div className="wr-board-metrics">
                <div>
                  <span>At risk</span>
                  <strong>{formatINR(item.revenue_at_risk)}</strong>
                </div>
                <div>
                  <span>Cases</span>
                  <strong>{item.affected_case_count}</strong>
                </div>
                <div>
                  <span>Health</span>
                  <strong>
                    {item.health_score} · {item.health_trend}
                  </strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{formatDuration(item.duration_minutes)}</strong>
                </div>
              </div>
              {item.primary_root_cause ? (
                <p className="wr-board-cause">
                  Primary cause · {formatAction(item.primary_root_cause)}
                </p>
              ) : null}
              <Link className="wr-open-btn" to={`/war-room/${item.incident_id}`}>
                Open War Room →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
