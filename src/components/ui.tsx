export function Loading({
  label = 'Loading',
  size = 'md',
}: {
  label?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={`loading-state${size === 'sm' ? ' loading-state-sm' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className={`loading-spinner${size === 'sm' ? ' loading-spinner-sm' : ''}`}
        aria-hidden="true"
      />
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-msg error">
      <strong>Could not load data.</strong>
      <p>{message}</p>
      <p className="hint">Is the API running at http://127.0.0.1:8000?</p>
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info'
  title?: string
}) {
  return (
    <span className={`badge tone-${tone}`} title={title}>
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  )
}

export function Section({
  title,
  children,
  right,
}: {
  title: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
