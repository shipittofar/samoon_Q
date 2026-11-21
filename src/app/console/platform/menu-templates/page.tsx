'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge, Card } from '@/components/ui'
import { BusinessTypeLabel, ErrorBox, PageHeader, selectClass } from '@/components/superadmin/shared'
import {
  BUSINESS_TYPE_VALUES,
  apiErrorMessage,
  superadminService,
  type BusinessTypeValue,
  type MenuTemplate,
  type MenuTemplateCategory,
  type MenuTemplateInput,
} from '@/services/superadmin.service'

const emptyItem = () => ({ name: '', description: '', price: '', preparation_time: null, calories: null })
const emptyCategory = (): MenuTemplateCategory => ({ name: '', description: '', items: [emptyItem()] })
const emptyDraft = (businessType: BusinessTypeValue = 'restaurant'): MenuTemplateInput => ({
  name: '',
  description: '',
  business_type: businessType,
  is_active: true,
  content: { categories: [emptyCategory()] },
})

/** Drop rows the editor left blank before sending. */
function cleanDraft(draft: MenuTemplateInput): MenuTemplateInput {
  return {
    ...draft,
    content: {
      categories: draft.content.categories
        .map((c) => ({
          ...c,
          items: c.items
            .filter((i) => i.name.trim())
            .map((i) => ({ ...i, price: i.price === '' ? '0' : i.price })),
        }))
        .filter((c) => c.name.trim()),
    },
  }
}

function TemplateEditor({
  draft,
  onChange,
}: {
  draft: MenuTemplateInput
  onChange: (next: MenuTemplateInput) => void
}) {
  const t = useTranslations('superadmin')
  const categories = draft.content.categories
  const setCategories = (next: MenuTemplateCategory[]) => onChange({ ...draft, content: { categories: next } })
  const patchCategory = (index: number, patch: Partial<MenuTemplateCategory>) =>
    setCategories(categories.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label={t('templates.name')} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} required />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tpl-type" className="text-sm font-medium text-[var(--fg)]">
            {t('templates.businessType')}
          </label>
          <select
            id="tpl-type"
            className={selectClass}
            value={draft.business_type}
            onChange={(e) => onChange({ ...draft, business_type: e.target.value as BusinessTypeValue })}
          >
            {BUSINESS_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t(`businessTypes.${v}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Textarea
        label={t('templates.description')}
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        rows={2}
      />
      <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => onChange({ ...draft, is_active: e.target.checked })}
        />
        {t('templates.active')}
      </label>

      <div className="space-y-3">
        {categories.map((category, ci) => (
          <div key={ci} className="rounded-xl border border-[var(--border)] p-3 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t('templates.categoryName')}
                  value={category.name}
                  onChange={(e) => patchCategory(ci, { name: e.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('templates.removeCategory')}
                onClick={() => setCategories(categories.filter((_, i) => i !== ci))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder={t('templates.categoryDescription')}
              aria-label={t('templates.categoryDescription')}
              value={category.description ?? ''}
              onChange={(e) => patchCategory(ci, { description: e.target.value })}
            />
            <div className="space-y-2">
              {category.items.map((item, ii) => {
                const patchItem = (patch: Record<string, unknown>) =>
                  patchCategory(ci, {
                    items: category.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)),
                  })
                return (
                  <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-4">
                      <Input
                        placeholder={t('templates.itemName')}
                        aria-label={t('templates.itemName')}
                        value={item.name}
                        onChange={(e) => patchItem({ name: e.target.value })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder={t('templates.itemPrice')}
                        aria-label={t('templates.itemPrice')}
                        value={String(item.price ?? '')}
                        onChange={(e) => patchItem({ price: e.target.value })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder={t('templates.itemPrep')}
                        aria-label={t('templates.itemPrep')}
                        value={item.preparation_time ?? ''}
                        onChange={(e) => patchItem({ preparation_time: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-3">
                      <Input
                        placeholder={t('templates.itemDescription')}
                        aria-label={t('templates.itemDescription')}
                        value={item.description ?? ''}
                        onChange={(e) => patchItem({ description: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('templates.removeItem')}
                        onClick={() => patchCategory(ci, { items: category.items.filter((_, j) => j !== ii) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => patchCategory(ci, { items: [...category.items, emptyItem()] })}
            >
              {t('templates.addItem')}
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCategories([...categories, emptyCategory()])}>
          {t('templates.addCategory')}
        </Button>
      </div>
    </div>
  )
}

export default function PlatformMenuTemplatesPage() {
  const t = useTranslations('superadmin')
  const [filter, setFilter] = useState('')
  const [templates, setTemplates] = useState<MenuTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; draft: MenuTemplateInput } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MenuTemplate | null>(null)

  const load = useCallback(() => {
    setError(null)
    superadminService
      .listTemplates(filter || undefined)
      .then(setTemplates)
      .catch(() => setError(t('common.error')))
  }, [filter, t])
  useEffect(load, [load])

  const save = async () => {
    if (!editing) return
    const draft = cleanDraft(editing.draft)
    if (!draft.name.trim()) {
      setFormError(`${t('templates.name')}: ${t('common.required')}`)
      return
    }
    if (draft.content.categories.length === 0) {
      setFormError(t('templates.noCategories'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editing.id) await superadminService.updateTemplate(editing.id, draft)
      else await superadminService.createTemplate(draft)
      setEditing(null)
      load()
    } catch (err) {
      setFormError(apiErrorMessage(err, t('common.error')))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      await superadminService.deleteTemplate(deleting.id)
      setDeleting(null)
      load()
    } catch (err) {
      setError(apiErrorMessage(err, t('common.error')))
      setDeleting(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setFormError(null)
              setEditing({ id: null, draft: emptyDraft((filter as BusinessTypeValue) || 'restaurant') })
            }}
          >
            {t('templates.new')}
          </Button>
        }
      />

      <div className="mb-4">
        <select aria-label={t('templates.businessType')} className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">
            {t('templates.businessType')}: {t('common.all')}
          </option>
          {BUSINESS_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`businessTypes.${v}`)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}
      {!templates && !error && <p className="text-sm text-[var(--fg-muted)]">{t('common.loading')}</p>}
      {templates && templates.length === 0 && (
        <p className="py-10 text-center text-sm text-[var(--fg-muted)]">{t('templates.empty')}</p>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates?.map((tpl) => (
          <Card key={tpl.id} padding="sm" className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--fg)] truncate">{tpl.name}</p>
                <p className="text-xs text-[var(--fg-muted)]">
                  <BusinessTypeLabel value={tpl.business_type} />
                </p>
              </div>
              <Badge variant={tpl.is_active ? 'success' : 'secondary'}>
                {tpl.is_active ? t('templates.active') : t('templates.inactive')}
              </Badge>
            </div>
            {tpl.description && <p className="text-sm text-[var(--fg-muted)] line-clamp-2">{tpl.description}</p>}
            <p className="text-xs text-[var(--fg-muted)]">
              {t('templates.categories', { count: tpl.category_count })} · {t('templates.items', { count: tpl.item_count })}
            </p>
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(tpl)}>
                {t('common.delete')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  setFormError(null)
                  setEditing({
                    id: tpl.id,
                    draft: {
                      name: tpl.name,
                      description: tpl.description,
                      business_type: tpl.business_type,
                      is_active: tpl.is_active,
                      content: {
                        categories: tpl.content.categories.length ? tpl.content.categories : [emptyCategory()],
                      },
                    },
                  })
                }}
              >
                {t('common.edit')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? t('templates.editTitle') : t('templates.newTitle')}
        size="xl"
      >
        {editing && (
          <div className="space-y-4">
            <TemplateEditor draft={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
            {formError && <ErrorBox message={formError} />}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button loading={saving} onClick={save}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('common.delete')} size="sm">
        <p className="text-sm text-[var(--fg-muted)] mb-4">{t('templates.deleteConfirm', { name: deleting?.name ?? '' })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" loading={saving} onClick={confirmDelete}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
