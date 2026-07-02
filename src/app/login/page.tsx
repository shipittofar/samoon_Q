'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, ShieldCheck, User, Crown, ChefHat, Megaphone, HeadphonesIcon, CreditCard, Layers, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui'
import { useLogin } from '@/hooks'
import toast from 'react-hot-toast'
import { LOGIN_LIMIT } from '@/lib/rate-limit'
import { getDemoRedirect, getPostLoginRedirect } from '@/utils/auth-redirect'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const DEMO_ACCOUNTS = [
  { label: 'Customer',       email: 'demo@savor.com',      phone: '+1 415 555 0101', description: 'Menu, orders, reservations',    icon: User,           color: 'text-blue-600 dark:text-blue-400',     bg: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',     border: 'border-blue-200 dark:border-blue-800' },
  { label: 'Staff',          email: 'staff@savor.com',     phone: '+1 415 555 0102', description: 'Manager — full ops',            icon: ShieldCheck,    color: 'text-green-600 dark:text-green-400',   bg: 'hover:bg-green-50 dark:hover:bg-green-950/20',   border: 'border-green-200 dark:border-green-800' },
  { label: 'Cashier',        email: 'cashier@savor.com',   phone: '+1 415 555 0103', description: 'Orders + customers',            icon: CreditCard,     color: 'text-cyan-600 dark:text-cyan-400',     bg: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',     border: 'border-cyan-200 dark:border-cyan-800' },
  { label: 'Kitchen',        email: 'kitchen@savor.com',   phone: '+1 415 555 0104', description: 'Order queue + kitchen display', icon: ChefHat,        color: 'text-amber-600 dark:text-amber-400',   bg: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800' },
  { label: 'Marketing',      email: 'marketing@savor.com', phone: '+1 415 555 0105', description: 'Analytics + promotions',        icon: Megaphone,      color: 'text-pink-600 dark:text-pink-400',     bg: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',     border: 'border-pink-200 dark:border-pink-800' },
  { label: 'Support',        email: 'support@savor.com',   phone: '+1 415 555 0106', description: 'Customers + reservations',      icon: HeadphonesIcon, color: 'text-indigo-600 dark:text-indigo-400', bg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20', border: 'border-indigo-200 dark:border-indigo-800' },
  { label: 'Admin',          email: 'admin@savor.com',     phone: '+1 415 555 0107', description: 'Full admin panel',              icon: ShieldCheck,    color: 'text-orange-600 dark:text-orange-400', bg: 'hover:bg-orange-50 dark:hover:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-800' },
  { label: 'Owner',          email: 'owner@savor.com',     phone: '+1 415 555 0108', description: 'Tenant management + all',       icon: Crown,          color: 'text-purple-600 dark:text-purple-400', bg: 'hover:bg-purple-50 dark:hover:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800' },
  { label: 'Platform Admin', email: 'platform@savor.com',  phone: '+1 415 555 0109', description: 'Cross-tenant platform access',  icon: Building2,      color: 'text-rose-600 dark:text-rose-400',     bg: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',     border: 'border-rose-200 dark:border-rose-800' },
  { label: 'Multi-Role',     email: 'multirole@savor.com', phone: '+1 415 555 0110', description: 'Cashier + Kitchen (P8.5)',      icon: Layers,         color: 'text-teal-600 dark:text-teal-400',     bg: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',     border: 'border-teal-200 dark:border-teal-800' },
]

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { mutate: login, isPending } = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (data: LoginFormData) => {
    const rateCheck = LOGIN_LIMIT.check(data.email)
    if (!rateCheck.allowed) {
      toast.error(`Too many login attempts. Please try again later.`)
      return
    }
    login(data, {
      onSuccess: (result) => {
        LOGIN_LIMIT.reset(data.email)
        toast.success('Welcome back!')
        router.push(getPostLoginRedirect(result.user.role))
      },
      onError: () => toast.error('Invalid credentials. Please try again.'),
    })
  }

  const fillDemo = (email = 'demo@savor.com') => {
    setValue('email', email)
    setValue('password', 'password')
  }

  const loginAs = (email: string) => {
    const rateCheck = LOGIN_LIMIT.check(email)
    if (!rateCheck.allowed) {
      toast.error('Too many login attempts. Please try again later.')
      return
    }
    login({ email, password: 'password' }, {
      onSuccess: () => {
        LOGIN_LIMIT.reset(email)
        toast.success('Welcome back!')
        router.push(getDemoRedirect(email))
      },
      onError: () => toast.error('Login failed. Please try again.'),
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold">S</span>
            </div>
            <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Savor</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-2">Welcome back</h1>
            <p className="text-[var(--fg-muted)]">Sign in to your account to continue</p>
          </div>

          {/* Demo Accounts */}
          {USE_MOCK ? (
            <div className="mb-6 space-y-2">
              <p className="text-xs font-medium text-[var(--fg-muted)] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-orange-500" /> Demo accounts (password: <code className="font-mono bg-[var(--card)] px-1 rounded">password</code>)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map(({ label, email, phone, description, icon: Icon, color, bg, border }) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => loginAs(email)}
                    disabled={isPending}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left transition-colors ${border} ${bg} disabled:opacity-50`}
                  >
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                      <Icon className="h-3.5 w-3.5" />{label}
                    </span>
                    <span className="text-[11px] text-[var(--fg-muted)] leading-tight">{description}</span>
                    <span className="text-[10px] text-[var(--fg-muted)] opacity-60 font-mono">{phone}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fillDemo()}
              className="w-full mb-6 flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Use Demo Account
            </button>
          )}

          <Divider label="or sign in with email" className="mb-6" />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              required
              leftIcon={<Mail className="h-3.5 w-3.5" />}
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
              autoComplete="email"
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-[var(--fg-muted)]">
                <input type="checkbox" className="accent-orange-500" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-orange-500 hover:text-orange-600 transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isPending} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--fg-muted)] mt-6">
            Dont have an account?{' '}
            <Link href="/register" className="text-orange-500 font-medium hover:text-orange-600 transition-colors">
              Create one →
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 2px, transparent 2px), radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="text-7xl mb-6">🍽️</div>
          <h2 className="font-[var(--font-display)] text-4xl font-bold mb-4">Fine Dining,<br />Delivered.</h2>
          <p className="text-white/80 max-w-sm text-lg leading-relaxed">
            Experience culinary excellence — from artisan pizzas to gourmet burgers, every bite crafted with passion.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-white/20" />
              ))}
            </div>
            <p className="text-sm text-white/70">Joined by 50,000+ foodies</p>
          </div>
        </div>
      </div>
    </div>
  )
}
