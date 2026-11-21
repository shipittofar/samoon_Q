'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui'
import { ErrorBox } from '@/components/superadmin/shared'
import {
  apiErrorMessage,
  menuTemplateService,
  type MenuTemplate,
} from '@/services/superadmin.service'

/**
 * Owner console: "Ready-made menus" — lists the menus platform superusers
 * prepared for this business type and copies one into the branch.
 */
export function MenuTemplatesButton({ branchId, onApplied }: { branchId: string; onApplied: () => void }) {
  const t = useTranslations('superadmin')
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<MenuTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  const show = () => {
    setOpen(true)
    setResult(null)
    setError(null)
    setTemplates(null)
    menuTemplateService
      .forBranch(branchId)
      .then(setTemplates)
      .catch((err) => setError(apiErrorMessage(err, t('common.error'))))
  }

  const apply = async (tpl: MenuTemplate) => {
    setApplying(tpl.id)
    setError(null)
    setResult(null)
    try {
      const r = await menuTemplateService.apply(branchId, tpl.id)
      setResult(
        t('ownerTemplates.result', {
          categories: r.created_categories,
          items: r.created_items,
          skipped: r.skipped_items,
        }),
      )
      onApplied()
    } catch (err) {
      setError(apiErrorMessage(err, t('common.error')))
    } finally {
      setApplying(null)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<BookOpen className="h-4 w-4" />}
        onClick={show}
        disabled={!branchId}
        title={branchId ? undefined : t('ownerTemplates.noBranch')}
      >
        {t('ownerTemplates.button')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('ownerTemplates.title')} description={t('ownerTemplates.description')} size="lg">
        <div className="space-y-3">
          {result && (
            <div role="status" className="rounded-xl bg-[var(--success-subtle)] p-3 text-sm text-[var(--success-text)]">
              {result}
            </div>
          )}
          {error && <ErrorBox message={error} />}
          {templates === null && !error && <p className="text-sm text-[var(--fg-muted)]">{t('common.loading')}</p>}
          {templates?.length === 0 && <p className="py-6 text-center text-sm text-[var(--fg-muted)]">{t('ownerTemplates.empty')}</p>}
          {templates?.map((tpl) => (
            <Card key={tpl.id} padding="sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--fg)]">{tpl.name}</p>
                  {tpl.description && <p className="text-sm text-[var(--fg-muted)]">{tpl.description}</p>}
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    {t('templates.categories', { count: tpl.category_count })} · {t('templates.items', { count: tpl.item_count })}
                  </p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)] line-clamp-2">
                    {tpl.content.categories.map((c) => c.name).join(' · ')}
                  </p>
                </div>
                <Button size="sm" loading={applying === tpl.id} disabled={applying !== null && applying !== tpl.id} onClick={() => apply(tpl)}>
                  {t('ownerTemplates.apply')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Modal>
    </>
  )
}
