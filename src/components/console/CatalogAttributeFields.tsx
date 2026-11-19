'use client'

/**
 * Phase 1 — schema-driven catalog fields for non-food verticals.
 *
 * Renders the item-kind picker (when the vertical offers more than one kind)
 * and every attribute that applies to the selected kind, straight from the
 * vertical's definition in src/verticals/registry.ts. Values stay raw
 * (strings / booleans) until menuItemFormToWriteRequest() serializes them.
 */
import { useTranslations } from 'next-intl'
import { Input, Textarea } from '@/components/ui/Input'
import {
  attributesForKind,
  effectiveItemKind,
  type CatalogAttributeFormValues,
  type CatalogItemKind,
  type VerticalDefinition,
} from '@/verticals'

const SELECT_CLASS =
  'w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]'

export function CatalogAttributeFields({
  vertical,
  itemKind,
  attributes,
  onChange,
}: {
  vertical: VerticalDefinition
  itemKind: CatalogItemKind | '' | undefined
  attributes: CatalogAttributeFormValues | undefined
  onChange: (next: { item_kind: CatalogItemKind; attributes: CatalogAttributeFormValues }) => void
}) {
  const t = useTranslations('verticals')
  const kind = effectiveItemKind(vertical, itemKind)
  const values = attributes ?? {}
  const defs = attributesForKind(vertical, kind)

  const setValue = (key: string, value: string | boolean) =>
    onChange({ item_kind: kind, attributes: { ...values, [key]: value } })

  return (
    <div className="space-y-4" data-testid="catalog-attribute-fields">
      {vertical.itemKinds.length > 1 && (
        <div>
          <label htmlFor="catalog-item-kind" className="block text-sm font-medium text-[var(--fg)] mb-1">
            {t('itemKindLabel')}
          </label>
          <select
            id="catalog-item-kind"
            value={kind}
            onChange={(e) => onChange({ item_kind: e.target.value as CatalogItemKind, attributes: values })}
            className={SELECT_CLASS}
          >
            {vertical.itemKinds.map((k) => (
              <option key={k} value={k}>{t(`itemKinds.${k}`)}</option>
            ))}
          </select>
        </div>
      )}

      {defs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {defs.map((def) => {
            const id = `catalog-attr-${def.key}`
            const label = t(`attributes.${def.key}`)
            switch (def.type) {
              case 'number':
                return (
                  <Input
                    key={def.key}
                    id={id}
                    label={label}
                    type="number"
                    min={def.min}
                    max={def.max}
                    value={typeof values[def.key] === 'string' ? (values[def.key] as string) : ''}
                    onChange={(e) => setValue(def.key, e.target.value)}
                  />
                )
              case 'boolean':
                return (
                  <label key={def.key} htmlFor={id} className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer sm:col-span-2">
                    <input
                      id={id}
                      type="checkbox"
                      className="rounded"
                      checked={values[def.key] === true}
                      onChange={(e) => setValue(def.key, e.target.checked)}
                    />
                    {label}
                  </label>
                )
              case 'select':
                return (
                  <div key={def.key}>
                    <label htmlFor={id} className="block text-sm font-medium text-[var(--fg)] mb-1">{label}</label>
                    <select
                      id={id}
                      value={typeof values[def.key] === 'string' ? (values[def.key] as string) : ''}
                      onChange={(e) => setValue(def.key, e.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">{t('selectPlaceholder')}</option>
                      {def.options?.map((opt) => (
                        <option key={opt} value={opt}>{t(`attributeOptions.${def.key}.${opt}`)}</option>
                      ))}
                    </select>
                  </div>
                )
              case 'text':
                return (
                  <div key={def.key} className="sm:col-span-2">
                    <Textarea
                      id={id}
                      label={label}
                      rows={2}
                      value={typeof values[def.key] === 'string' ? (values[def.key] as string) : ''}
                      onChange={(e) => setValue(def.key, e.target.value)}
                    />
                  </div>
                )
            }
          })}
        </div>
      )}
    </div>
  )
}
