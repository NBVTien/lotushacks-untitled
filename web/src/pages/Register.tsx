import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { LayoutDashboard, Loader2 } from 'lucide-react'
import { PageTransition } from '@/components/ui/motion'
import { toast } from 'sonner'

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

type RegField = 'name' | 'email' | 'password' | 'companyName'

export function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegField, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<RegField, boolean>>>({})

  const validateField = (field: RegField, value: string) => {
    if (field === 'name' && !value.trim()) return 'Name is required'
    if (field === 'email') {
      if (!value.trim()) return 'Email is required'
      if (!isValidEmail(value)) return 'Please enter a valid email'
    }
    if (field === 'password') {
      if (!value.trim()) return 'Password is required'
      if (value.length < 6) return 'Password must be at least 6 characters'
    }
    if (field === 'companyName' && !value.trim()) return 'Company name is required'
    return undefined
  }

  const handleBlur = (field: RegField) => {
    setTouched((t) => ({ ...t, [field]: true }))
    setFieldErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }))
  }

  const validateAll = () => {
    const fields: RegField[] = ['name', 'email', 'password', 'companyName']
    const errs: Partial<Record<RegField, string>> = {}
    const t: Partial<Record<RegField, boolean>> = {}
    for (const f of fields) {
      errs[f] = validateField(f, form[f])
      t[f] = true
    }
    setFieldErrors(errs)
    setTouched(t)
    return !Object.values(errs).some(Boolean)
  }

  const hasErrors =
    !form.name.trim() ||
    !form.email.trim() ||
    !isValidEmail(form.email) ||
    !form.password.trim() ||
    form.password.length < 6 ||
    !form.companyName.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) return
    setError('')
    setLoading(true)
    try {
      const res = await authApi.register(form)
      login(res.accessToken, res.user)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      const errorMsg = msg || 'Registration failed'
      setError(errorMsg)
      toast.error(errorMsg)
    }
    setLoading(false)
  }

  const update = (field: RegField, value: string) => {
    setForm({ ...form, [field]: value })
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <PageTransition>
      <div className="flex min-h-screen">
        {/* Left -- brand panel */}
        <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Recruit AI</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Start hiring
              <br />
              smarter today.
            </h2>
            <p className="mt-4 max-w-md text-base text-white/70">
              Create your account and begin evaluating candidates with AI-powered insights from
              their online presence.
            </p>
          </div>
          <p className="text-sm text-white/40">AI Recruitment Copilot</p>
        </div>

        {/* Right -- form */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <LayoutDashboard className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold">Recruit AI</span>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-8 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Create Account</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started with your hiring copilot
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    placeholder="Nguyen Van A"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    className={`h-12 text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${touched.name && fieldErrors.name ? 'border-destructive' : ''}`}
                  />
                  {touched.name && fieldErrors.name && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
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
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                    className={`h-12 text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${touched.password && fieldErrors.password ? 'border-destructive' : ''}`}
                  />
                  {touched.password && fieldErrors.password && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input
                    id="company"
                    placeholder="Your company"
                    value={form.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                    onBlur={() => handleBlur('companyName')}
                    className={`h-12 text-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${touched.companyName && fieldErrors.companyName ? 'border-destructive' : ''}`}
                  />
                  {touched.companyName && fieldErrors.companyName && (
                    <p className="text-sm text-destructive mt-1">{fieldErrors.companyName}</p>
                  )}
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading || hasErrors}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
