import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { AuditPage } from './pages/AuditPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { CasesPage } from './pages/CasesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { MonitoringPage } from './pages/MonitoringPage'
import { ReviewPage } from './pages/ReviewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
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
