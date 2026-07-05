/**
 * ConfigurationFieldBadges — P9.1.3 Phase F/H (Validation & Configuration States)
 *
 * Pure presentational badges derived entirely from field metadata — no
 * per-field logic, no per-module logic. Every badge here is driven by
 * `field.lifecycle`, `field.governance`, or the computed
 * `ConfigFieldState` (configUiHelpers.ts), never a hardcoded field id.
 */
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import type { ConfigFieldState } from './configUiHelpers'
import type { ConfigFieldDefinition } from '@/config'

export function ConfigurationFieldBadges({ field, state, isDirty }: {
  field: ConfigFieldDefinition
  state: ConfigFieldState
  isDirty: boolean
}) {
  const t = useTranslations('console')
  const badges: ReactNode[] = []

  if (isDirty) {
    badges.push(<Badge key="unsaved" variant="warning">{t('unsavedBadge2')}</Badge>)
  } else if (state !== 'default') {
    badges.push(<Badge key="state" variant="info">{t(`fieldState_${state}`)}</Badge>)
  }

  if (field.lifecycle === 'draft') badges.push(<Badge key="draft" variant="secondary">{t('draftBadge')}</Badge>)
  if (field.lifecycle === 'testing') badges.push(<Badge key="testing" variant="purple">{t('betaBadge')}</Badge>)
  if (field.lifecycle === 'deprecated') badges.push(<Badge key="deprecated" variant="secondary">{t('deprecatedBadge')}</Badge>)
  if (field.lifecycle === 'archived') badges.push(<Badge key="archived" variant="outline">{t('archivedReadOnlyBadge')}</Badge>)

  if (field.governance?.dangerous) badges.push(<Badge key="dangerous" variant="danger">{t('dangerousBadge')}</Badge>)
  if (field.governance?.experimental) badges.push(<Badge key="experimental" variant="purple">{t('experimentalBadge')}</Badge>)
  if (field.governance?.beta && field.lifecycle !== 'testing') badges.push(<Badge key="beta" variant="purple">{t('betaBadge')}</Badge>)
  if (field.governance?.internalOnly) badges.push(<Badge key="internal" variant="outline">{t('internalOnlyBadge')}</Badge>)
  if (field.governance?.requiresRestart) badges.push(<Badge key="restart" variant="warning">{t('restartRequiredBadge')}</Badge>)
  if (field.governance?.requiresPublish) badges.push(<Badge key="publish" variant="warning">{t('publishRequiredBadge')}</Badge>)
  if (field.governance?.requiresApproval) badges.push(<Badge key="approval" variant="warning">{t('requiresApprovalBadge')}</Badge>)
  if (field.governance?.securityLevel === 'critical' || field.governance?.securityLevel === 'high') {
    badges.push(<Badge key="security" variant="danger">{t('securitySensitiveBadge')}</Badge>)
  }
  if (field.inheritance.mode === 'locked') badges.push(<Badge key="locked" variant="outline">{t('lockedBadge')}</Badge>)
  if (field.display?.badge) badges.push(<Badge key="custom" variant="default">{field.display.badge}</Badge>)

  if (badges.length === 0) return null
  return <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
}
