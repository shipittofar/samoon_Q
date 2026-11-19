'use client'

/**
 * Day planner page — Phase L5 ("مسیر روز من"). The customer lists what they
 * want to do; the plan (branch per task + order + times) updates live.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowDown, ArrowUp, Car, Bike, Footprints, CarTaxiFront, Clock, ExternalLink, Flag, Hourglass,
  Plus, Route, Sparkles, Trash2, AlertTriangle, type LucideIcon,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { LocationChip } from '@/components/location/LocationChip'
import { DirectionsButton } from '@/components/location/DirectionsButton'
import { MapViewLazy, type MapMarker } from '@/components/maps'
import { useDiscover } from '@/hooks'
import { useUserLocation } from '@/hooks/location'
import { useDayPlanStore } from '@/stores/day-plan-store'
import { useNavigationStore, type TravelModePreference } from '@/stores/navigation-store'
import { buildPlanTasks, candidatesForTask, type PlanTaskSpec } from '@/lib/planner/candidates'
import { formatClock, MAX_TASKS, parseClock, planDay, type DayPlan } from '@/lib/planner/plan'
import { buildMultiStopGoogleUrl } from '@/lib/navigation/deep-links'
import { normalizeSearchText } from '@/lib/search-normalize'
import { BUSINESS_TYPE_LABELS } from '@/types/marketplace'
import { TRAVEL_MODES, type TravelMode } from '@/lib/travel'
import { resolveVertical } from '@/verticals'
import { cn } from '@/utils'

const MODE_ICONS: Record<TravelMode, LucideIcon> = { drive: Car, taxi: CarTaxiFront, walk: Footprints, bike: Bike }

function nowRounded(): number {
  const d = new Date()
  return Math.ceil((d.getHours() * 60 + d.getMinutes()) / 5) * 5
}

export function PlanClientPage() {
  const t = useTranslations('planner')
  const tMarket = useTranslations('marketplace')
  const tDir = useTranslations('directions')
  const { data: items = [], isLoading } = useDiscover()
  const { location } = useUserLocation()
  const store = useDayPlanStore()
  const { travelMode, setTravelMode } = useNavigationStore()

  // Start time / weekday live in the page (a plan is for today).
  const [startClock, setStartClock] = useState<string>('')
  useEffect(() => setStartClock(formatClock(nowRounded())), [])
  const startMin = parseClock(startClock) ?? 0
  const [weekday, setWeekday] = useState(0)
  useEffect(() => setWeekday(new Date().getDay()), [])

  const [draft, setDraft] = useState('')
  const located = location.source !== 'default'
  const start = location.point

  const categories = useMemo(() => {
    const seen = new Set<string>()
    items.forEach((i) => i.tenant.businessTypes.forEach((b) => seen.add(b)))
    return [...seen]
  }, [items])
  const categoryLabel = (bt: string) => (BUSINESS_TYPE_LABELS[bt] ? tMarket(`businessTypes.${bt}`) : bt)

  const businessMatches = useMemo(() => {
    const q = normalizeSearchText(draft)
    if (q.length < 2) return []
    return items.filter((i) => normalizeSearchText(i.tenant.name).includes(q)).slice(0, 4)
  }, [draft, items])

  const add = (task: Omit<PlanTaskSpec, 'id'>) => {
    if (store.addTask(task)) setDraft('')
  }

  const plannerItems = items
  const tasks = useMemo(() => buildPlanTasks(plannerItems, store.tasks, start), [plannerItems, store.tasks, start])
  const options = {
    start,
    startMin,
    weekday,
    travelMode,
    returnToStart: store.returnToStart,
  } as const
  const plan: DayPlan | null = useMemo(
    () => (tasks.length && startClock ? planDay(tasks, { ...options, optimizeOrder: store.optimizeOrder }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, startClock, startMin, weekday, travelMode, store.optimizeOrder, store.returnToStart, start],
  )
  // How much the optimized order saves over the customer's own order.
  const asListed = useMemo(
    () => (plan && store.optimizeOrder && tasks.length > 1 ? planDay(tasks, { ...options, optimizeOrder: false }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, tasks],
  )
  const savedMin =
    plan && asListed && asListed.stops.length === plan.stops.length ? Math.max(0, asListed.finishAt - plan.finishAt) : 0

  const taskById = new Map(store.tasks.map((s) => [s.id, s]))
  const markers: MapMarker[] = [
    ...(plan?.stops ?? []).map((s, i) => ({
      id: `${s.taskId}-${i}`,
      position: s.candidate.point,
      emoji: String(i + 1),
      label: `${i + 1}. ${taskById.get(s.taskId)?.label ?? ''} — ${s.candidate.tenantName}`,
    })),
    ...(located ? [{ id: 'me', position: start, variant: 'user' as const, label: t('start') }] : []),
  ]
  const path = plan?.stops.length
    ? [start, ...plan.stops.map((s) => s.candidate.point), ...(store.returnToStart ? [start] : [])]
    : []
  const googleUrl = plan?.stops.length
    ? buildMultiStopGoogleUrl(
        [...plan.stops.map((s) => s.candidate.point), ...(store.returnToStart ? [start] : [])],
        travelMode === 'auto' ? 'drive' : travelMode,
      )
    : null

  const duration = (min: number) =>
    min >= 60 ? t('hoursMinutes', { hours: Math.floor(min / 60), minutes: Math.round(min % 60) }) : t('minutes', { minutes: Math.round(min) })

  return (
    <>
      <Header />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <div className="mb-4 space-y-2">
          <h1 className="flex items-center gap-2 font-[var(--font-display)] text-2xl font-semibold text-[var(--fg)]">
            <Route className="h-6 w-6 text-[var(--accent-text)]" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="text-sm text-[var(--fg-muted)]">{t('intro')}</p>
          <LocationChip />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Tasks & options ── */}
          <section aria-labelledby="plan-tasks-heading" className="space-y-4">
            <h2 id="plan-tasks-heading" className="sr-only">{t('tasksHeading')}</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const q = draft.trim()
                if (q) add({ kind: 'query', label: q, query: q })
              }}
              className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <label htmlFor="plan-add" className="text-sm font-medium text-[var(--fg)]">{t('addLabel')}</label>
              <div className="flex gap-2">
                <input
                  id="plan-add"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('addPlaceholder')}
                  disabled={store.tasks.length >= MAX_TASKS}
                  className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--fg)]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || store.tasks.length >= MAX_TASKS}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('add')}
                </button>
              </div>
              {businessMatches.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t('businessMatchesAria')}>
                  {businessMatches.map((i) => (
                    <li key={i.tenant.id}>
                      <button
                        type="button"
                        onClick={() => add({ kind: 'business', label: i.tenant.name, tenantId: i.tenant.id })}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--card-hover)]"
                      >
                        {resolveVertical(i.tenant.businessTypes).emoji} {i.tenant.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => add({ kind: 'category', label: categoryLabel(bt), businessType: bt })}
                    disabled={store.tasks.length >= MAX_TASKS}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-50"
                  >
                    {resolveVertical([bt]).emoji} {categoryLabel(bt)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--fg-subtle)]">{t('addHint', { max: MAX_TASKS })}</p>
            </form>

            {store.tasks.length > 0 && (
              <ol className="space-y-2" data-testid="plan-task-list">
                {store.tasks.map((spec, i) => {
                  const count = candidatesForTask(plannerItems, spec, start).length
                  const engineTask = tasks.find((x) => x.id === spec.id)
                  return (
                    <li key={spec.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-xs font-semibold">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--fg)]">{spec.label}</p>
                          <p className={cn('text-xs', count ? 'text-[var(--fg-muted)]' : 'text-[var(--danger-text,var(--fg-muted))]')}>
                            {isLoading ? '…' : count ? t('candidates', { count }) : t('noCandidates')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <button type="button" onClick={() => store.moveTask(spec.id, -1)} disabled={i === 0} aria-label={t('moveUp')} className="rounded p-1.5 hover:bg-[var(--card-hover)] disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => store.moveTask(spec.id, 1)} disabled={i === store.tasks.length - 1} aria-label={t('moveDown')} className="rounded p-1.5 hover:bg-[var(--card-hover)] disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => store.removeTask(spec.id)} aria-label={t('remove', { label: spec.label })} className="rounded p-1.5 text-[var(--fg-muted)] hover:bg-[var(--card-hover)]">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 ps-8 text-xs text-[var(--fg-muted)]">
                        <label className="inline-flex items-center gap-1">
                          <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('stayFor')}
                          <input
                            type="number"
                            min={5}
                            max={480}
                            step={5}
                            value={spec.durationMin ?? engineTask?.durationMin ?? ''}
                            onChange={(e) => store.updateTask(spec.id, { durationMin: e.target.value ? Number(e.target.value) : null })}
                            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                          />
                          {t('minShort')}
                        </label>
                        <label className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('atTime')}
                          <input
                            type="time"
                            value={spec.at ?? ''}
                            onChange={(e) => store.updateTask(spec.id, { at: e.target.value || null })}
                            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--fg)]"
                          />
                        </label>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              <legend className="sr-only">{t('optionsLegend')}</legend>
              <label className="flex items-center justify-between gap-2">
                <span>{t('startTime')}</span>
                <input
                  type="time"
                  value={startClock}
                  onChange={(e) => setStartClock(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                />
              </label>
              <div role="radiogroup" aria-label={tDir('travelModeAria')} className="flex flex-wrap gap-2">
                {(['auto', ...TRAVEL_MODES] as TravelModePreference[]).map((m) => {
                  const Icon = m === 'auto' ? Sparkles : MODE_ICONS[m]
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={travelMode === m}
                      onClick={() => setTravelMode(m)}
                      className={cn(
                        'inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs',
                        travelMode === m ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]' : 'border-[var(--border)]',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {m === 'auto' ? t('modeAuto') : tDir(`mode_${m}`)}
                    </button>
                  )
                })}
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={store.optimizeOrder} onChange={(e) => store.setOptimizeOrder(e.target.checked)} />
                {t('optimizeOrder')}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={store.returnToStart} onChange={(e) => store.setReturnToStart(e.target.checked)} />
                {t('returnToStart')}
              </label>
              {store.tasks.length > 0 && (
                <button type="button" onClick={store.clear} className="text-xs text-[var(--fg-muted)] hover:underline">
                  {t('clearAll')}
                </button>
              )}
            </fieldset>
          </section>

          {/* ── Result ── */}
          <section aria-labelledby="plan-result-heading" className="space-y-4" aria-live="polite">
            <h2 id="plan-result-heading" className="font-semibold text-[var(--fg)]">{t('resultHeading')}</h2>
            {!located && (
              <p className="rounded-xl bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning-text)]">{t('approxStart')}</p>
            )}
            {!plan ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--fg-muted)]">
                {t('emptyState')}
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" data-testid="plan-summary">
                  <p className="text-lg font-semibold text-[var(--fg)]">
                    {plan.stops.length ? t('finishAt', { time: formatClock(plan.finishAt) }) : t('nothingFits')}
                  </p>
                  {plan.stops.length > 0 && (
                    <p className="text-sm text-[var(--fg-muted)]">
                      {t('summary', { travel: duration(plan.totalTravelMin), wait: duration(plan.totalWaitMin), stops: plan.stops.length })}
                    </p>
                  )}
                  {savedMin > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--success-text)]">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {t('saved', { time: duration(savedMin) })}
                    </p>
                  )}
                  {googleUrl && (
                    <a
                      href={googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      {t('openAllInGoogle')}
                    </a>
                  )}
                </div>

                {plan.stops.length > 0 && (
                  <MapViewLazy
                    center={plan.stops[0].candidate.point}
                    zoom={13}
                    markers={markers}
                    routes={located ? [{ id: 'day', points: path, dashed: true }] : [{ id: 'day', points: path.slice(1, store.returnToStart ? -1 : undefined), dashed: true }]}
                    fitMarkersKey={markers.map((m) => m.id + m.position.lat).join('|')}
                    fitPoints={markers.map((m) => m.position)}
                    ariaLabel={t('mapAria')}
                    className="h-72 w-full overflow-hidden rounded-2xl border border-[var(--border)]"
                  />
                )}

                <ol className="space-y-2" data-testid="plan-timeline">
                  {plan.stops.map((s, i) => {
                    const Icon = MODE_ICONS[s.travelMode]
                    const spec = taskById.get(s.taskId)
                    return (
                      <li key={`${s.taskId}-${i}`} className="space-y-2">
                        <p className="flex items-center gap-2 ps-3 text-xs text-[var(--fg-muted)]">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {s.travelMin > 0 ? t('leg', { time: duration(s.travelMin) }) : t('sameSpot')}
                          {s.waitMin > 0 && <span className="text-[var(--warning-text)]">· {t('wait', { time: duration(s.waitMin) })}</span>}
                        </p>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                          <div className="flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)]">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-[var(--fg-muted)]">{spec?.label}</p>
                              <p className="font-semibold text-[var(--fg)]">
                                {s.candidate.emoji} {s.candidate.tenantName}
                                <span className="font-normal text-[var(--fg-muted)]"> — {s.candidate.branchName}</span>
                              </p>
                              <p className="text-sm text-[var(--fg)]">
                                {t('timeRange', { start: formatClock(s.startAt), end: formatClock(s.leaveAt) })}
                              </p>
                              {s.hoursUnknown && <p className="text-xs text-[var(--fg-subtle)]">{t('hoursUnknown')}</p>}
                            </div>
                            <DirectionsButton
                              latitude={s.candidate.point.lat}
                              longitude={s.candidate.point.lng}
                              name={s.candidate.tenantName}
                              address={s.candidate.address}
                              emoji={s.candidate.emoji}
                            />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {store.returnToStart && plan.stops.length > 0 && (
                    <li className="flex items-center gap-2 ps-3 text-xs text-[var(--fg-muted)]">
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('backHome', { time: duration(plan.returnTravelMin), at: formatClock(plan.finishAt) })}
                    </li>
                  )}
                </ol>

                {plan.skipped.length > 0 && (
                  <div className="rounded-2xl border border-[var(--warning-border,var(--border))] bg-[var(--warning-subtle)] p-3 text-sm text-[var(--warning-text)]" data-testid="plan-skipped">
                    <p className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      {t('skippedHeading')}
                    </p>
                    <ul className="mt-1 list-disc ps-5">
                      {plan.skipped.map((s) => (
                        <li key={s.taskId}>
                          {taskById.get(s.taskId)?.label}: {t(`skip_${s.reason}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
