import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-atmosphere" aria-hidden="true">
        <div className="landing-orb landing-orb-a" />
        <div className="landing-orb landing-orb-b" />
        <div className="landing-grid" />
        <div className="landing-beam" />
      </div>

      <header className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          <img src="/revive-logo.png" alt="" className="landing-nav-logo" />
          <span>REVIVE</span>
        </Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-brand">REVIVE</p>
          <h1 className="landing-headline">Recover Revenue. Intelligently.</h1>
          <p className="landing-support">
            An autonomous B2B receivables recovery platform that detects payment
            risk, diagnoses the underlying cause, chooses the best recovery
            action, and safely executes it.
          </p>
          <div className="landing-ctas">
            <Link to="/dashboard" className="landing-cta primary">
              Open Operations
            </Link>
            <Link to="/cases/RISK-00003" className="landing-cta ghost">
              See a live case
            </Link>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-logo-ring" aria-hidden="true" />
          <div className="landing-logo-ring ring-delayed" aria-hidden="true" />
          <img
            src="/revive-logo.png"
            alt="Revive"
            className="landing-hero-logo"
          />
        </div>
      </section>

      <section className="landing-flow" aria-label="Recovery pipeline">
        <p className="landing-flow-label">The recovery loop</p>
        <ol className="landing-flow-steps">
          <li>Detect</li>
          <li className="landing-flow-arrow" aria-hidden="true">
            →
          </li>
          <li>Diagnose</li>
          <li className="landing-flow-arrow" aria-hidden="true">
            →
          </li>
          <li>Decide</li>
          <li className="landing-flow-arrow" aria-hidden="true">
            →
          </li>
          <li>Validate</li>
          <li className="landing-flow-arrow" aria-hidden="true">
            →
          </li>
          <li>Execute</li>
          <li className="landing-flow-arrow" aria-hidden="true">
            →
          </li>
          <li>Monitor</li>
        </ol>
      </section>
    </div>
  )
}
