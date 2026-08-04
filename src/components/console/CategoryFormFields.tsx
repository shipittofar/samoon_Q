'use client'

import { useTranslations } from 'next-intl'
import { Input, Textarea } from '@/components/ui/Input'
import { ImageUploader } from '@/components/ImageUploader'
import type { CategoryFormInput } from '@/types'

export function CategoryFormFields({
  form,
  onChange,
  error,
}: {
  form: CategoryFormInput
  onChange: (f: CategoryFormInput) => void
  error: string | null
}) {
  const t = useTranslations('console')
  const set = (field: Exclude<keyof CategoryFormInput, 'image'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="space-y-4 mb-4">
      <Input label={t('categoryNameLabel')} value={form.name} onChange={set('name')} />
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={3} />
      <ImageUploader
        label={t('imageLabel')}
        value={form.image}
        onChange={(image) => onChange({ ...form, image })}
      />
      <Input label={t('sortOrderLabel')} type="number" min={1} value={form.sort_order} onChange={set('sort_order')} />
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="rounded" />
        {t('active')}
      </label>
      {error && <p className="text-sm text-red-500">{t(`categoryFormError.${error}`)}</p>}
    </div>
  )
}
