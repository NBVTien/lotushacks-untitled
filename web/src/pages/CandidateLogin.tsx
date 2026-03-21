import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Briefcase, Loader2 } from 'lucide-react'
import { PageTransition } from '@/components/ui/motion'
import { toast } from 'sonner'

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export function CandidateLoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => { document.title = 'Sign In — TalentLens Career Portal' }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})

  const validateField = (field: 'email' | 'password', value: string) => {
    if (field === 'email') {
      if (!value.trim()) return 'Email is required'
      if (!isValidEmail(value)) return 'Please enter a valid email'
    }
    if (field === 'password') {
      if (!value.trim()) return 'Password is required'
      if (value.length < 6) return 'Password must be at least 6 characters'
    }
    return undefined
  }

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((t) => ({ ...t, [field]: true }))
    const value = field === 'email' ? email : password
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
  }

  const validateAll = () => {
    const errs = {
      email: validateField('email', email),
      password: validateField('password', password),
    }
    setFieldErrors(errs)
    setTouched({ email: true, password: true })
    return !errs.email && !errs.password
  }

  const hasErrors = !email.trim() || !isValidEmail(email) || !password.trim() || password.length < 6

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) return
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      if (res.user.role !== 'candidate') {
        setError('This login is for candidates only. Please use the recruiter login.')
        toast.error('This login is for candidates only')
        setLoading(false)
        return
      }
      login(res.accessToken, res.user)
      navigate('/careers/portal')
    } catch {
      setError('Invalid email or password')
      toast.error('Invalid email or password')
    }
    setLoading(false)
  }

  return (
    <PageTransition>
      <div className="flex min-h-screen">
        {/* Left -- brand panel */}
        <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Career Portal</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Your career,
              <br />
              supercharged by AI.
            </h2>
            <p className="mt-4 max-w-md text-base text-white/70">
              Analyze your CV, find skill gaps, and get personalized learning resources to land your
              dream job.
            </p>
          </div>
          <p className="text-sm text-white/40">AI Career Copilot</p>
        </div>

        {/* Right -- form */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold">Career Portal</span>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-8 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your candidate account</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    onBlur={() => handleBlur('email')}
                    className={`h-12 text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${touched.email && fieldErrors.email ? 'border-destructive' : ''}`}
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password)
                        setFieldErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    onBlur={() => handleBlur('password')}
                    className={`h-12 text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${touched.password && fieldErrors.password ? 'border-destructive' : ''}`}
                  />
                  {touched.password && fieldErrors.password && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
                  )}
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading || hasErrors}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/careers/register" className="font-medium text-primary hover:underline">
                  Register
                </Link>
              </p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Recruiter login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
