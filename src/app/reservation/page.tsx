'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Calendar, Clock, Users, User, Phone, CheckCircle2, MapPin, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui'
import { useCreateReservation, useAvailableSlots, useTenantsBranches } from '@/hooks'
import { useAuthStore, useBranchStore, useTenantStore } from '@/stores'
import { cn } from '@/utils'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import type { Reservation } from '@/types'
import { MapPinOff } from 'lucide-react'
import { resolveReservationPageView } from '@/lib/reservation-page-state'

// Schema messages are `validation` namespace keys (Phase E), resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.
const reservationSchema = z.object({
  name: z.string().min(2, 'required'),
  phone_number: z.string().min(10, 'invalid_phone'),
  guests: z.number().min(1).max(20),
  date: z.string().min(1, 'required'),
  time: z.string().min(1, 'required'),
  notes: z.string().optional(),
  branch_id: z.string().min(1, 'required'),
})

type ReservationFormData = z.infer<typeof reservationSchema>

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

const DAY_MS = 86_400_000
/** yyyy-mm-dd in the visitor's calendar (toISOString would use UTC's day). */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Server refusals the guest can act on (core/exceptions/reservations.py). */
const REFUSALS = ['reservation_time_unavailable', 'reservation_already_booked', 'party_size_exceeds_capacity', 'reservations_disabled']

export default function ReservationPage() {
  const router = useRouter()
  const t = useTranslations('reservation')
  const tValidation = useTranslations('validation')
  const tCommon = useTranslations('common')
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const activeBranchId = useBranchStore((s) => s.activeBranch?.id)
  const activeBranchReservationsEnabled = useBranchStore((s) => s.activeBranch?.reservationsEnabled)
  const [confirmed, setConfirmed] = useState<Reservation | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(() => activeBranchId ?? '')
  const { mutate: createReservation, isPending: isSubmitting } = useCreateReservation()
  const {
    data: branches,
    isPending: branchesPending,
    isError: branchesError,
    refetch: refetchBranches,
  } = useTenantsBranches()
  const reservationBranches = (branches ?? []).filter((b) => b.reservationsEnabled === true)
  const noBusiness = useTenantStore((s) => s.tenantState !== 'loading' && !s.tenant)
  const pageView = resolveReservationPageView({
    noBusiness,
    branchesPending,
    branchesError,
    activeBranchReservationsEnabled,
    reservationBranchCount: reservationBranches.length,
  })

  const { register, handleSubmit, setValue, getValues, watch, formState: { errors } } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { guests: 2, branch_id: activeBranchId ?? '' },
  })

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranch(activeBranchId)
      setValue('branch_id', activeBranchId)
    }
  }, [activeBranchId, setValue])

  const watchedGuests = watch('guests')
  const watchedTime = watch('time')
  const { data: slots, isLoading: slotsLoading, isError: slotsError } = useAvailableSlots(selectedDate, selectedBranch, watchedGuests)

  // Signed in: start with the account's own name and phone.
  useEffect(() => {
    if (!user) return
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    if (name && !getValues('name')) setValue('name', name)
    if (user.phone_number && !getValues('phone_number')) setValue('phone_number', user.phone_number)
  }, [user, getValues, setValue])

  // The chosen time is gone for this branch, day or number of guests.
  useEffect(() => {
    if (slots && watchedTime && !slots.includes(watchedTime)) setValue('time', '')
  }, [slots, watchedTime, setValue])

  const onSubmit = (data: ReservationFormData) => {
    createReservation(data, {
      onSuccess: (res) => {
        toast.success(res.status === 'pending' ? t('requestSentToast') : t('reservationConfirmedToast'))
        const branchName = reservationBranches.find((b) => b.id === data.branch_id)?.name || ''
        const params = new URLSearchParams({
          code: res.confirmation_code ?? '',
          date: res.date,
          time: res.time,
          guests: String(res.guests),
          name: res.name,
          branch: branchName,
          status: res.status,
          id: res.id,
        })
        router.push(`/reservation/confirm?${params.toString()}`)
        setConfirmed(res)
      },
      onError: (err) => {
        const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
        toast.error(code && REFUSALS.includes(code) ? t(`refusal.${code}`) : t('reservationFailed'))
        void queryClient.invalidateQueries({ queryKey: ['available-slots'] })
      },
    })
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="pb-16 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full mx-4 bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-active)] p-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4">
                <CheckCircle2 className="h-10 w-10 text-white"/>
              </motion.div>
              <h2 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">{confirmed.status === 'pending' ? t('requestSent') : t('confirmed')}</h2>
              <p className="text-white/80 text-sm">{confirmed.status === 'pending' ? t('requestSentDesc') : t('lookForwardToSeeing')}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[var(--card-hover)] rounded-2xl p-4 text-center">
                <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1">{t('confirmationCode')}</p>
                <p className="font-[var(--font-display)] text-2xl font-bold text-[var(--accent-text)]">{confirmed.confirmation_code}</p>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { icon: User, label: t('name'), value: confirmed.name },
                  { icon: Calendar, label: t('date'), value: confirmed.date },
                  { icon: Clock, label: t('time'), value: confirmed.time },
                  { icon: Users, label: t('guests'), value: t('peopleSuffix', { count: confirmed.guests }) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-[var(--accent-text)]"/>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
                      <p className="font-medium text-[var(--fg)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full"onClick={() => setConfirmed(null)}>{t('makeAnotherReservation')}</Button>
            </div>
          </motion.div>
        </div>
        <Footer />
      </div>
    )
  }

  if (pageView === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div
          className="pb-16"
          role="status"
          aria-busy="true"
          aria-label={t('loadingAria')}
        >
          <div className="bg-gradient-to-b from-[var(--accent-subtle)] to-transparent py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
              <Skeleton className="h-4 w-32 mx-auto" />
              <Skeleton className="h-10 w-72 mx-auto" />
              <Skeleton className="h-4 w-96 max-w-full mx-auto" />
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (pageView === 'no-business') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <MapPin className="h-12 w-12 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('chooseBusinessTitle')}</h1>
          <p className="text-[var(--fg-muted)]">{t('chooseBusinessDesc')}</p>
          <Link href="/discover"><Button>{t('browseBusinesses')}</Button></Link>
        </div>
      </div>
    )
  }

  if (pageView === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <AlertCircle className="h-12 w-12 text-[var(--danger-text)]"/>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('failedToLoadTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('failedToLoadDesc')}</p>
          <Button variant="secondary" onClick={() => { void refetchBranches() }}>{tCommon('retry')}</Button>
        </div>
      </div>
    )
  }

  if (pageView === 'unavailable-branch') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <MapPinOff className="h-12 w-12 text-[var(--fg-subtle)]"/>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('reservationsUnavailableTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('reservationsUnavailableDesc')}</p>
        </div>
      </div>
    )
  }

  if (pageView === 'unavailable-empty') {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <MapPinOff className="h-12 w-12 text-[var(--fg-subtle)]"/>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('reservationsUnavailableTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('noReservationBranchesDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pb-16">
        {/* Hero */}
        <div className="bg-gradient-to-b from-[var(--accent-subtle)] to-transparent py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-[var(--accent-text)] uppercase tracking-widest mb-2">{t('reservationsLabel')}</p>
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl font-bold text-[var(--fg)] mb-3">{t('reserveYourTable')}</h1>
            <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
              {t('bookPerfectExperience')}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          {!authLoading && !isAuthenticated && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-sm text-[var(--fg)]">{t('signInToReserve')}</p>
              <Link href={`/login?redirect=${encodeURIComponent(pathname)}`}>
                <Button size="sm">{t('signIn')}</Button>
              </Link>
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Branch */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--accent-text)]"/> {t('chooseBranch')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {reservationBranches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => { setSelectedBranch(branch.id); setValue('branch_id', branch.id) }}
                    className={cn(
                      'p-4 rounded-xl border-2 text-start transition-all',
                      selectedBranch === branch.id
                        ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border)] hover:border-[var(--accent-border)]/50',
                    )}
                  >
                    <p className={cn('text-sm font-semibold', selectedBranch === branch.id ? 'text-[var(--accent-text)]' : 'text-[var(--fg)]')}>{branch.name}</p>
                    {/* <p className="text-xs text-[var(--fg-muted)] mt-1">{branch.city}</p>
                    <p className="text-xs text-[var(--fg-muted)] mt-1">{branch.address}</p> */}
                  </button>
                ))}
              </div>
            </div>

            {/* Date, Time, Guests */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--accent-text)]"/> {t('dateTimeHeading')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-1.5 block">{t('date')} <span className="text-[var(--accent-text)]">*</span></label>
                  <input
                    type="date"
                    min={isoDay(new Date())}
                    max={isoDay(new Date(Date.now() + 60 * DAY_MS))}
                    {...register('date')}
                    onChange={(e) => { setSelectedDate(e.target.value); register('date').onChange(e) }}
                    className="w-full h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)] transition-all"
                  />
                  {errors.date && <p className="text-xs text-[var(--danger-text)] mt-1">⚠ {tValidation(errors.date.message)}</p>}
                </div>

                {/* Guests */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-1.5 block">
                    {t('guests')} <span className="text-[var(--accent-text)]">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GUEST_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setValue('guests', n)}
                        className={cn(
                          'h-10 w-10 rounded-xl border-2 text-sm font-medium transition-all',
                          watchedGuests === n
                            ? 'border-[var(--accent-border)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/30'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setValue('guests', 10)}
                      className={cn(
                        'h-10 px-3 rounded-xl border-2 text-sm font-medium transition-all',
                        watchedGuests > 8
                          ? 'border-[var(--accent-border)] bg-[var(--accent)] text-[var(--accent-fg)]'
                          : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50',
                      )}
                    >
                      {t('moreGuests')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Time Slots */}
              <div className="mt-6">
                <label className="text-sm font-medium text-[var(--fg)] mb-3 flex items-center gap-2 block">
                  <Clock className="h-4 w-4 text-[var(--accent-text)]"/>
                  {t('availableTimeSlots')} {selectedDate && <span className="text-[var(--fg-muted)] font-normal">{t('availableTimeSlotsFor', { date: selectedDate })}</span>}
                  <span className="text-[var(--accent-text)]">*</span>
                </label>
                {!selectedDate ? (
                  <p className="text-sm text-[var(--fg-muted)] italic">{t('selectDateFirst')}</p>
                ) : slotsLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-20 rounded-xl"/>)}
                  </div>
                ) : slotsError ? (
                  <p className="text-sm text-[var(--danger-text)]">{t('slotsFailed')}</p>
                ) : (slots ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--fg-muted)]">{t('noSlots')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(slots || []).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={watchedTime === slot}
                        onClick={() => setValue('time', slot, { shouldValidate: true })}
                        className={cn(
                          'h-9 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                          watchedTime === slot
                            ? 'border-[var(--accent-border)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/30'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50',
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                {errors.time && <p className="text-xs text-[var(--danger-text)] mt-2">⚠ {tValidation(errors.time.message)}</p>}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--accent-text)]"/> {t('contactInformation')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input label={t('fullName')} required {...register('name')} error={errors.name?.message ? tValidation(errors.name.message) : undefined} leftIcon={<User className="h-3.5 w-3.5"/>} />
                </div>
                <Input label={t('phone_number')} type="tel"required {...register('phone_number')} error={errors.phone_number?.message ? tValidation(errors.phone_number.message) : undefined} leftIcon={<Phone className="h-3.5 w-3.5"/>} />
                <div className="sm:col-span-2">
                  <Textarea label={t('specialRequests')} {...register('notes')} placeholder={t('specialRequestsPlaceholder')} rows={3} />
                </div>
              </div>
            </div>

            <Button type="submit"className="w-full"size="xl"loading={isSubmitting} disabled={!isAuthenticated} leftIcon={<CheckCircle2 className="h-5 w-5"/>}>
              {isSubmitting ? t('confirmingReservation') : t('confirmReservationButton')}
            </Button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}
