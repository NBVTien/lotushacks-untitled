import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Button } from './components/ui/button'
import { JobsPage } from './pages/Jobs'
import { JobDetailPage } from './pages/JobDetail'
import { CandidateDetailPage } from './pages/CandidateDetail'
import { CareersPage } from './pages/Careers'
import { ApplyPage } from './pages/Apply'
import { JobDiscoveryPage } from './pages/JobDiscovery'
import { CompanyResearchPage } from './pages/CompanyResearch'
import { CandidateSourcingPage } from './pages/CandidateSourcing'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function NavBar() {
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const isCareers = location.pathname.startsWith('/careers')
  const isAuth = location.pathname === '/login' || location.pathname === '/register'

  if (isCareers) {
    return (
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-6 px-4">
          <Link to="/careers" className="text-lg font-semibold">
            Careers
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/careers/discover" className="hover:text-foreground">
              Discover Jobs
            </Link>
          </nav>
        </div>
      </header>
    )
  }

  if (isAuth) return null

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold">
            Recruitment Copilot
          </Link>
          {isAuthenticated && (
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Jobs
              </Link>
            </nav>
          )}
        </div>
        {isAuthenticated && user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user.name} &middot; {user.company?.name}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <NavBar />
          <main className="mx-auto max-w-6xl p-4">
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Recruiter (protected) */}
              <Route path="/" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
              <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
              <Route path="/jobs/:jobId/source" element={<ProtectedRoute><CandidateSourcingPage /></ProtectedRoute>} />
              <Route path="/jobs/:jobId/candidates/:candidateId" element={<ProtectedRoute><CandidateDetailPage /></ProtectedRoute>} />

              {/* Candidate (public) */}
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/careers/discover" element={<JobDiscoveryPage />} />
              <Route path="/careers/company/:name" element={<CompanyResearchPage />} />
              <Route path="/careers/:jobId/apply" element={<ApplyPage />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
