'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Save } from 'lucide-react'
import { HeroBackgroundGallery } from '@/components/admin/HeroBackgroundGallery'
import { Button } from '@/components/ui/Button'
import {
  usePlatformHomepageHero,
  useSavePlatformHomepageHero,
  useUploadPlatformHomepageMedia,
} from '@/hooks'
import type { PlatformHomepageHero } from '@/types/website-builder'
import {
  DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
  DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
} from '@/types/website-builder'

export function PlatformHomepageHeroEditor() {
  const t = useTranslations('console')
  const { data, isLoading, error } = usePlatformHomepageHero()
  const saveHero = useSavePlatformHomepageHero()
  const uploadMedia = useUploadPlatformHomepageMedia()
  const [draft, setDraft] = useState<PlatformHomepageHero | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data && draft === null) setDraft(data)
  }, [data, draft])

  const current: PlatformHomepageHero = draft ?? data ?? {
    backgroundImages: [],
    slideshowIntervalMs: DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
    slideshowTransitionMs: DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
  }

  const update = useCallback((patch: Partial<PlatformHomepageHero>) => {
    setDraft((prev) => ({
      ...(prev ?? data ?? {
        backgroundImages: [],
        slideshowIntervalMs: DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
        slideshowTransitionMs: DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
      }),
      ...patch,
    }))
  }, [data])

  async function handleSave() {
    await saveHero.mutateAsync(current)
    setDraft(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 justify-center h-64 text-[var(--fg-muted)]">
        <Loader2 className="w-5 h-5 animate-spin" />
        {t('loadingPlatformHomepage')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--danger-text)] text-sm">
        {t('failedToLoadPlatformHomepage')}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">{t('platformHomepageTitle')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('platformHomepageSubtitle')}</p>
        </div>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveHero.isPending || draft === null}
          leftIcon={
            saved ? <CheckCircle2 className="h-4 w-4" /> : saveHero.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
          }
        >
          {saved ? t('savedLabel') : t('save')}
        </Button>
      </div>

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
        <HeroBackgroundGallery
          images={current.backgroundImages}
          onChange={(backgroundImages) => update({ backgroundImages })}
          onUpload={async (file) => {
            const { url } = await uploadMedia.mutateAsync(file)
            return url
          }}
          intervalMs={current.slideshowIntervalMs}
          transitionMs={current.slideshowTransitionMs}
          onIntervalChange={(slideshowIntervalMs) => update({ slideshowIntervalMs })}
          onTransitionChange={(slideshowTransitionMs) => update({ slideshowTransitionMs })}
        />
      </div>
    </div>
  )
}
