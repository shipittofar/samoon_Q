'use client'

/**
 * ConfigurationInheritanceTree — P9.3 Phase F (Framework Improvement)
 *
 * Visualizes one field's Platform -> Tenant -> Branch -> User chain using
 * `configurationService.getFieldLayers` (the raw per-level values, added in
 * P9.3 to support exactly this) alongside its resolved effective value.
 * Purely generic — driven entirely by `field.inheritance` metadata and the
 * resolver's own chain order (`CONFIG_INHERITANCE_CHAIN`), so it renders
 * identically for any field in any module, collection property included.
 */
import { useTranslations } from 'next-intl'
import { CONFIG_INHERITANCE_CHAIN, configurationService } from '@/config'
import type { ConfigFieldDefinition, ConfigResolutionScope } from '@/config'
import { Badge } from '@/components/ui'

export function ConfigurationInheritanceTree({ field, scope }: { field: ConfigFieldDefinition; scope: ConfigResolutionScope }) {
  const t = useTranslations('console')
  const LEVEL_LABEL: Record<string, string> = {
    platform: t('levelPlatform'),
    tenant: t('levelTenant'),
    branch: t('levelBranch'),
    user: t('levelUser'),
  }
  const layers = configurationService.getFieldLayers(field.id, scope)
  const resolved = configurationService.resolveField(field.id, scope)
  const ownerIndex = CONFIG_INHERITANCE_CHAIN.indexOf(field.inheritance.level)

  return (
    <div className="space-y-2"role="list"aria-label={t('inheritanceChainAria')}>
      {CONFIG_INHERITANCE_CHAIN.map((level, i) => {
        const levelIndex = CONFIG_INHERITANCE_CHAIN.indexOf(level)
        const hasValue = layers[level] !== undefined
        const isOwner = level === field.inheritance.level
        const isEffective = resolved.resolvedFrom === level
        const isBelowOwner = levelIndex > ownerIndex
        const isBlockedOverride = isBelowOwner && hasValue && (!field.inheritance.canOverride || field.inheritance.mode === 'locked') && !isEffective

        return (
          <div key={level} role="listitem"className="flex items-center gap-3">
            <div className="flex w-20 shrink-0 flex-col items-start">
              <span className="text-xs font-medium text-[var(--fg)]">{LEVEL_LABEL[level]}</span>
              {isOwner && <span className="text-[10px] text-[var(--fg-muted)]">{t('ownerLabel')}</span>}
            </div>
            <div
              className={`flex flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                isEffective
                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                  : hasValue
                    ? 'border-[var(--border)] bg-[var(--card)]'
                    : 'border-dashed border-[var(--border)] bg-transparent opacity-60'
              }`}
            >
              <span className="truncate font-mono text-[var(--fg)]">
                {hasValue ? JSON.stringify(layers[level]) : t('inheritsFromAbove')}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {isEffective && <Badge variant="default">{t('effectiveLabel')}</Badge>}
                {isBlockedOverride && <Badge variant="danger">{t('blockedLabel')}</Badge>}
                {hasValue && !isEffective && !isBlockedOverride && <Badge variant="secondary">{t('overriddenLabel')}</Badge>}
              </div>
            </div>
            {i < CONFIG_INHERITANCE_CHAIN.length - 1 && (
              <span className="sr-only">{t('thenLabel')}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
