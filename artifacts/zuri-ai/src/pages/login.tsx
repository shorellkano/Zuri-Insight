import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import zuriLogo from '/zuri-ai-logo.png'

function parseHashParams(): Record<string, string> {
  const hash = window.location.hash.replace(/^#/, '')
  return Object.fromEntries(new URLSearchParams(hash))
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hashState, setHashState] = useState<'idle' | 'confirming' | 'confirmed' | 'error'>('idle')
  const [hashError, setHashError] = useState('')
  const [, setLocation] = useLocation()
  const { toast } = useToast()

  useEffect(() => {
    const params = parseHashParams()

    if (params.error) {
      const desc = params.error_description?.replace(/\+/g, ' ') ?? params.error
      if (params.error_code === 'otp_expired') {
        setHashError('This confirmation link has expired. Please sign up again to get a new one.')
      } else if (params.error === 'access_denied') {
        setHashError('Email confirmation failed. The link may have already been used.')
      } else {
        setHashError(desc)
      }
      setHashState('error')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    if (params.access_token) {
      setHashState('confirming')
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token ?? '',
      }).then(({ error }) => {
        if (error) {
          setHashError('Could not confirm your account. Please try signing in.')
          setHashState('error')
        } else {
          setHashState('confirmed')
          window.history.replaceState(null, '', window.location.pathname)
          setTimeout(() => setLocation('/dashboard'), 1200)
        }
      })
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' })
    } else {
      setLocation('/dashboard')
    }
  }

  if (hashState === 'confirming') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Confirming your account...</p>
        </div>
      </div>
    )
  }

  if (hashState === 'confirmed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <p className="text-lg font-semibold text-foreground">Account confirmed!</p>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <img src={zuriLogo} alt="Zuri AI" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your Zuri AI account</p>
        </div>

        {hashState === 'error' && (
          <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Confirmation failed</p>
              <p className="text-sm text-red-700 mt-0.5">{hashError}</p>
              <Link to="/signup" className="text-sm text-red-700 font-medium underline mt-2 inline-block">
                Sign up again
              </Link>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="input-email"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="input-password"
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  data-testid="btn-toggle-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              data-testid="btn-login"
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
