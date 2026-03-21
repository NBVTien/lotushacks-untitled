import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/toast'
import { DashboardPage } from './pages/Dashboard'
import { JobsPage } from './pages/Jobs'
import { JobDetailPage } from './pages/JobDetail'
import { CandidateDetailPage } from './pages/CandidateDetail'
import { CareersPage } from './pages/Careers'
import { ApplyPage } from './pages/Apply'
import { CompanyResearchPage } from './pages/CompanyResearch'
import { CandidateComparePage } from './pages/CandidateCompare'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { CandidateLoginPage } from './pages/CandidateLogin'
import { CandidateRegisterPage } from './pages/CandidateRegister'
import { CandidatePortalPage } from './pages/CandidatePortal'
import { GapAnalysisPage } from './pages/GapAnalysis'
import { LearningResourcesPage } from './pages/LearningResources'
import { Briefcase, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react'
import { ThemeProvider, useTheme } from './lib/theme'
import { ErrorBoundary } from './components/ErrorBoundary'

function RecruiterProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/recruiter/login" replace />
  if (user?.role === 'candidate') return <Navigate to="/portal" replace />
  return <>{children}</>
}

function CandidateProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'candidate') return <Navigate to="/" replace />
  return <>{children}</>
}

function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className={`rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const navItems = [
    { to: '/recruiter', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/recruiter/jobs', label: 'Jobs', icon: Briefcase },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/50 bg-background lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold tracking-tight">TalentLens Recruiter</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.to === '/recruiter'
              ? location.pathname === '/recruiter'
              : location.pathname === item.to || location.pathname.startsWith(item.to + '/')
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-primary/8 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="border-t border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.company?.name}</p>
            </div>
            <ThemeToggle />
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

function MobileHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 px-4 bg-background/95 backdrop-blur-sm lg:hidden">
      <Link to="/recruiter" className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <LayoutDashboard className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">TalentLens Recruiter</span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <Button variant="ghost" size="xs" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

function CareersNav() {
  const location = useLocation()
  const { isAuthenticated, isCandidate, logout } = useAuth()

  const navLinks = isAuthenticated && isCandidate
    ? [
        { to: '/portal', label: 'My Profile' },
        { to: '/portal/gap-analysis', label: 'Gap Analysis' },
      ]
    : [
        { to: '/login', label: 'Login' },
      ]

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Briefcase className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight">TalentLens</span>
        </Link>
        <nav className="flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to || location.pathname.startsWith(link.to + '/')
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm transition-colors duration-150 py-1 ${
                  isActive
                    ? 'text-foreground font-medium border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          {isAuthenticated && isCandidate && (
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Logout
            </button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}

function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <MobileHeader />
      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <ErrorBoundary>
          <Routes>
            {/* Candidate auth — no nav */}
            <Route path="/login" element={<CandidateLoginPage />} />
            <Route path="/register" element={<CandidateRegisterPage />} />

            {/* Recruiter auth — no nav */}
            <Route path="/recruiter/login" element={<LoginPage />} />
            <Route path="/recruiter/register" element={<RegisterPage />} />

            {/* Careers (default, public) — careers nav */}
            <Route
              path="/"
              element={
                <>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <CareersPage />
                  </main>
                </>
              }
            />
            <Route
              path="/company/:name"
              element={
                <>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <CompanyResearchPage />
                  </main>
                </>
              }
            />
            <Route
              path="/jobs/:jobId/apply"
              element={
                <>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <ApplyPage />
                  </main>
                </>
              }
            />

            {/* Candidate Portal (protected, candidate only) */}
            <Route
              path="/portal"
              element={
                <CandidateProtectedRoute>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <CandidatePortalPage />
                  </main>
                </CandidateProtectedRoute>
              }
            />
            <Route
              path="/portal/gap-analysis"
              element={
                <CandidateProtectedRoute>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <GapAnalysisPage />
                  </main>
                </CandidateProtectedRoute>
              }
            />
            <Route
              path="/portal/gap-analysis/:analysisId/resources"
              element={
                <CandidateProtectedRoute>
                  <CareersNav />
                  <main className="mx-auto max-w-5xl px-6 py-8">
                    <LearningResourcesPage />
                  </main>
                </CandidateProtectedRoute>
              }
            />

            {/* Recruiter (protected) — sidebar layout */}
            <Route
              path="/recruiter"
              element={
                <RecruiterProtectedRoute>
                  <RecruiterLayout>
                    <DashboardPage />
                  </RecruiterLayout>
                </RecruiterProtectedRoute>
              }
            />
            <Route
              path="/recruiter/jobs"
              element={
                <RecruiterProtectedRoute>
                  <RecruiterLayout>
                    <JobsPage />
                  </RecruiterLayout>
                </RecruiterProtectedRoute>
              }
            />
            <Route
              path="/recruiter/jobs/:jobId"
              element={
                <RecruiterProtectedRoute>
                  <RecruiterLayout>
                    <JobDetailPage />
                  </RecruiterLayout>
                </RecruiterProtectedRoute>
              }
            />
            <Route
              path="/recruiter/jobs/:jobId/compare"
              element={
                <RecruiterProtectedRoute>
                  <RecruiterLayout>
                    <CandidateComparePage />
                  </RecruiterLayout>
                </RecruiterProtectedRoute>
              }
            />
            <Route
              path="/recruiter/jobs/:jobId/candidates/:candidateId"
              element={
                <RecruiterProtectedRoute>
                  <RecruiterLayout>
                    <CandidateDetailPage />
                  </RecruiterLayout>
                </RecruiterProtectedRoute>
              }
            />

            {/* Legacy redirects */}
            <Route path="/careers" element={<Navigate to="/" replace />} />
            <Route path="/careers/*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
