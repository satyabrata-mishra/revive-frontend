import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuditPage } from './pages/AuditPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { CasesPage } from './pages/CasesPage'
import { DashboardPage } from './pages/DashboardPage'
import { ForecastPage } from './pages/ForecastPage'
import { IntelligencePage } from './pages/IntelligencePage'
import { LandingPage } from './pages/LandingPage'
import { MonitoringPage } from './pages/MonitoringPage'
import { OptimizePage } from './pages/OptimizePage'
import { ControlTowerPage } from './pages/ControlTowerPage'
import { ReviewPage } from './pages/ReviewPage'
import { SimulatorPage } from './pages/SimulatorPage'
import { StrategyLabPage } from './pages/StrategyLabPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="control-tower" element={<ControlTowerPage />} />
          <Route path="optimize" element={<OptimizePage />} />
          <Route path="intelligence" element={<IntelligencePage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="strategy-lab" element={<StrategyLabPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
