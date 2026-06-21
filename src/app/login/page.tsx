'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui'
import { useLogin } from '@/hooks'
import toast from 'react-hot-toast'
import { LOGIN_LIMIT } from '@/lib/rate-limit'

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
      onSuccess: () => {
        LOGIN_LIMIT.reset(data.email)
        toast.success('Welcome back!!! 👋')
        router.push('/')
      },
      onError: () => toast.error('Invalid credentials. Please try again.'),
    })
  }

  const fillDemo = () => {
    setValue('email', 'demo@savor.com')
    setValue('password', 'password')
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

          {/* Demo Button */}
          <button
            type="button"
            onClick={fillDemo}
            className="w-full mb-6 flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Use Demo Account
          </button>

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
