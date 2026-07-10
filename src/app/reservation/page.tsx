'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, Users, User, Phone, Mail, CheckCircle2, ArrowLeft, MapPin } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui'
import { useCreateReservation, useAvailableSlots, useBranches } from '@/hooks'
import { useBranchStore } from '@/stores'
import { formatCurrency, cn } from '@/utils'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import type { Reservation } from '@/types'

// Schema messages are `validation` namespace keys (Phase E), resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.
const reservationSchema = z.object({
  name: z.string().min(2, 'required'),
  phone_number: z.string().min(10, 'invalid_phone'),
  email: z.string().email('invalid_email').optional().or(z.literal('')),
  guests: z.number().min(1).max(20),
  date: z.string().min(1, 'required'),
  time: z.string().min(1, 'required'),
  notes: z.string().optional(),
  branch_id: z.string().min(1, 'required'),
})

type ReservationFormData = z.infer<typeof reservationSchema>

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const minDate = tomorrow.toISOString().split('T')[0]

export default function ReservationPage() {
  const router = useRouter()
  const t = useTranslations('reservation')
  const tValidation = useTranslations('validation')
  const activeBranchId = useBranchStore((s) => s.activeBranch?.id)
  const [confirmed, setConfirmed] = useState<Reservation | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(() => activeBranchId ?? '')
  const { mutate: createReservation, isPending } = useCreateReservation()
  const { data: branches } = useBranches()
  const { data: slots, isLoading: slotsLoading } = useAvailableSlots(selectedDate, selectedBranch)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ReservationFormData>({
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

  const onSubmit = (data: ReservationFormData) => {
    createReservation(data, {
      onSuccess: (res) => {
        toast.success(t('reservationConfirmedToast'))
        const branchName = branches?.find((b) => b.id === data.branch_id)?.name || ''
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
      onError: () => toast.error(t('reservationFailed')),
    })
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full mx-4 bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>
              <h2 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">{t('confirmed')}</h2>
              <p className="text-white/80 text-sm">{t('lookForwardToSeeing')}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[var(--card-hover)] rounded-2xl p-4 text-center">
                <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1">{t('confirmationCode')}</p>
                <p className="font-[var(--font-display)] text-2xl font-bold text-orange-500">{confirmed.confirmation_code}</p>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { icon: User, label: t('name'), value: confirmed.name },
                  { icon: Calendar, label: t('date'), value: confirmed.date },
                  { icon: Clock, label: t('time'), value: confirmed.time },
                  { icon: Users, label: t('guests'), value: t('peopleSuffix', { count: confirmed.guests }) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
                      <p className="font-medium text-[var(--fg)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--fg-muted)] text-center bg-[var(--card-hover)] rounded-xl p-3">
                {t('confirmationSentTo', { contact: confirmed.email || confirmed.phone_number })}
              </p>
              <Button className="w-full" onClick={() => setConfirmed(null)}>{t('makeAnotherReservation')}</Button>
            </div>
          </motion.div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        {/* Hero */}
        <div className="bg-gradient-to-b from-orange-50/80 to-transparent dark:from-orange-950/20 dark:to-transparent py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">{t('reservationsLabel')}</p>
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl font-bold text-[var(--fg)] mb-3">{t('reserveYourTable')}</h1>
            <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
              {t('bookPerfectExperience')}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Branch */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-500" /> {t('chooseBranch')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(branches || []).map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => { setSelectedBranch(branch.id); setValue('branch_id', branch.id) }}
                    className={cn(
                      'p-4 rounded-xl border-2 text-start transition-all',
                      selectedBranch === branch.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                        : 'border-[var(--border)] hover:border-orange-200',
                    )}
                  >
                    <p className={cn('text-sm font-semibold', selectedBranch === branch.id ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]')}>{branch.name}</p>
                    <p className="text-xs text-[var(--fg-muted)] mt-1">{branch.address}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date, Time, Guests */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-orange-500" /> {t('dateTimeHeading')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Date */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-1.5 block">{t('date')} <span className="text-orange-500">*</span></label>
                  <input
                    type="date"
                    min={minDate}
                    {...register('date')}
                    onChange={(e) => { setSelectedDate(e.target.value); register('date').onChange(e) }}
                    className="w-full h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                  />
                  {errors.date && <p className="text-xs text-red-500 mt-1">⚠ {tValidation(errors.date.message)}</p>}
                </div>

                {/* Guests */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-1.5 block">
                    {t('guests')} <span className="text-orange-500">*</span>
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
                            ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-300',
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
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-300',
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
                  <Clock className="h-4 w-4 text-orange-500" />
                  {t('availableTimeSlots')} {selectedDate && <span className="text-[var(--fg-muted)] font-normal">{t('availableTimeSlotsFor', { date: selectedDate })}</span>}
                  <span className="text-orange-500">*</span>
                </label>
                {!selectedDate ? (
                  <p className="text-sm text-[var(--fg-muted)] italic">{t('selectDateFirst')}</p>
                ) : slotsLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-20 rounded-xl" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(slots || []).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setValue('time', slot)}
                        className={cn(
                          'h-9 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                          watchedTime === slot
                            ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-300',
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                {errors.time && <p className="text-xs text-red-500 mt-2">⚠ {tValidation(errors.time.message)}</p>}
              </div>
            </div>

            {/* Contact */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-orange-500" /> {t('contactInformation')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input label={t('fullName')} required {...register('name')} error={errors.name?.message ? tValidation(errors.name.message) : undefined} leftIcon={<User className="h-3.5 w-3.5" />} />
                </div>
                <Input label={t('phone_number')} type="tel" required {...register('phone_number')} error={errors.phone_number?.message ? tValidation(errors.phone_number.message) : undefined} leftIcon={<Phone className="h-3.5 w-3.5" />} />
                <Input label={t('email')} type="email" {...register('email')} error={errors.email?.message ? tValidation(errors.email.message) : undefined} leftIcon={<Mail className="h-3.5 w-3.5" />} />
                <div className="sm:col-span-2">
                  <Textarea label={t('specialRequests')} {...register('notes')} placeholder={t('specialRequestsPlaceholder')} rows={3} />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="xl" loading={isPending} leftIcon={<CheckCircle2 className="h-5 w-5" />}>
              {isPending ? t('confirmingReservation') : t('confirmReservationButton')}
            </Button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
}
