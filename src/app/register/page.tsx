'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Check } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useRegister } from '@/hooks'
import toast from 'react-hot-toast'

const registerSchema = z.object({
  first_name: z.string().min(2, 'First name required'),
  last_name: z.string().min(2, 'Last name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type RegisterFormData = z.infer<typeof registerSchema>

const PERKS = [
  'Exclusive member deals & discounts',
  'Faster checkout with saved details',
  'Real-time order tracking',
  'Priority table reservations',
]

export default function RegisterPage() {
  const router = useRouter()
  const { mutate: doRegister, isPending } = useRegister()
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = (data: RegisterFormData) => {
    doRegister(data, {
      onSuccess: () => {
        toast.success('Account created! Welcome to Savor 🎉')
        router.push('/')
      },
      onError: () => toast.error('Registration failed. Email may already be in use.'),
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex">
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 60% 40%, white 2px, transparent 2px)', backgroundSize: '50px 50px' }} />
        <Link href="/" className="relative flex items-center gap-2 mb-auto">
          <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white font-bold">S</span>
          </div>
          <span className="font-[var(--font-display)] text-xl font-bold text-white">Savor</span>
        </Link>
        <div className="relative text-white">
          <h2 className="font-[var(--font-display)] text-4xl font-bold mb-4">Join the Savor Family</h2>
          <p className="text-white/80 text-lg mb-8">Create your account and unlock a world of culinary delights.</p>
          <div className="space-y-4">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white/90">{perk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8">
            <Link href="/" className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Savor</span>
            </Link>
            <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-2">Create account</h1>
            <p className="text-[var(--fg-muted)]">Join thousands of food lovers today</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" required leftIcon={<User className="h-3.5 w-3.5" />} placeholder="John" {...register('first_name')} error={errors.first_name?.message} />
              <Input label="Last Name" required placeholder="Doe" {...register('last_name')} error={errors.last_name?.message} />
            </div>
            <Input label="Email" type="email" required leftIcon={<Mail className="h-3.5 w-3.5" />} placeholder="you@example.com" {...register('email')} error={errors.email?.message} />
            <Input label="Phone" type="tel" leftIcon={<Phone className="h-3.5 w-3.5" />} placeholder="+1 234 567 8900" {...register('phone')} error={errors.phone?.message} />
            <Input
              label="Password" type={showPw ? 'text' : 'password'} required
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              rightIcon={<button type="button" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">{showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
              placeholder="Min. 8 characters" {...register('password')} error={errors.password?.message}
            />
            <Input
              label="Confirm Password" type={showConfirm ? 'text' : 'password'} required
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              rightIcon={<button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle confirm password">{showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>}
              placeholder="Repeat password" {...register('confirm_password')} error={errors.confirm_password?.message}
            />
            <p className="text-xs text-[var(--fg-muted)]">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-orange-500 hover:underline">Terms</Link>{' '}and{' '}
              <Link href="/privacy" className="text-orange-500 hover:underline">Privacy Policy</Link>.
            </p>
            <Button type="submit" className="w-full" size="lg" loading={isPending} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--fg-muted)] mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-500 font-medium hover:text-orange-600 transition-colors">Sign in →</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
