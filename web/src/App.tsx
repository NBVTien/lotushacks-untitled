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
import { Briefcase, LogOut, LayoutDashboard } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const navItems = [
    { to: '/', label: 'Jobs', icon: Briefcase },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
          <LayoutDashboard className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight">Recruit AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
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
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.company?.name}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm lg:hidden">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand">
          <LayoutDashboard className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold">Recruit AI</span>
      </Link>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user.name}</span>
          <Button variant="ghost" size="xs" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </header>
  )
}

function CareersNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-sm dark:bg-background/80">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/careers" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">Careers</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/careers/discover" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Discover Jobs
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            For Recruiters
          </Link>
        </div>
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
        <div className="mx-auto max-w-6xl px-6 py-8">
          {children}
        </div>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth — no nav */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Recruiter (protected) — sidebar layout */}
          <Route path="/" element={
            <ProtectedRoute>
              <RecruiterLayout><JobsPage /></RecruiterLayout>
            </ProtectedRoute>
          } />
          <Route path="/jobs/:jobId" element={
            <ProtectedRoute>
              <RecruiterLayout><JobDetailPage /></RecruiterLayout>
            </ProtectedRoute>
          } />
          <Route path="/jobs/:jobId/source" element={
            <ProtectedRoute>
              <RecruiterLayout><CandidateSourcingPage /></RecruiterLayout>
            </ProtectedRoute>
          } />
          <Route path="/jobs/:jobId/candidates/:candidateId" element={
            <ProtectedRoute>
              <RecruiterLayout><CandidateDetailPage /></RecruiterLayout>
            </ProtectedRoute>
          } />

          {/* Candidate (public) — careers nav */}
          <Route path="/careers" element={
            <>
              <CareersNav />
              <main className="mx-auto max-w-5xl px-6 py-8">
                <CareersPage />
              </main>
            </>
          } />
          <Route path="/careers/discover" element={
            <>
              <CareersNav />
              <main className="mx-auto max-w-5xl px-6 py-8">
                <JobDiscoveryPage />
              </main>
            </>
          } />
          <Route path="/careers/company/:name" element={
            <>
              <CareersNav />
              <main className="mx-auto max-w-5xl px-6 py-8">
                <CompanyResearchPage />
              </main>
            </>
          } />
          <Route path="/careers/:jobId/apply" element={
            <>
              <CareersNav />
              <main className="mx-auto max-w-5xl px-6 py-8">
                <ApplyPage />
              </main>
            </>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
