'use client'



import { use } from 'react'

import Link from 'next/link'

import { useTranslations } from 'next-intl'

import { ArrowLeft, Lock } from 'lucide-react'

import { PermissionGuard } from '@/components/auth/PermissionGuard'

import { AccessDenied } from '@/components/admin/AccessDenied'

import { ErrorBoundary } from '@/components/common/ErrorBoundary'

import { RolePermissionEditor } from '@/components/admin/RolePermissionEditor'

import { useTenantRoles, usePermission, useConsoleTenantId } from '@/hooks'



interface PageProps {

  params: Promise<{ id: string }>

}



export default function RoleDetailPage({ params }: PageProps) {

  const { id } = use(params)

  const t = useTranslations('console')

  const tenantId = useConsoleTenantId() ?? ''

  const { data: roles = [], isLoading } = useTenantRoles(tenantId)

  const role = roles.find((r) => r.id === id)

  const canManageRoles = usePermission('rbac.manage_roles')

  const isSystemRole = role?.isSystemRole ?? false

  const readOnly = isSystemRole || !canManageRoles



  return (

    <ErrorBoundary feature="Role Permissions">

      <PermissionGuard permission="rbac.manage_roles"fallback={<AccessDenied />}>

        <main className="p-6 space-y-6 max-w-4xl">

          <Link

            href="/console/roles"

            className="flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"

          >

            <ArrowLeft className="w-4 h-4"/>

            {t('backToRolesLabel')}

          </Link>



          {isLoading ? (

            <p className="text-sm text-[var(--fg-muted)]">{t('loadingEllipsis')}</p>

          ) : !role ? (

            <p className="text-sm text-[var(--fg-muted)]">{t('roleNotFound')}</p>

          ) : (

            <>

              <div className="space-y-2">

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-2xl font-bold text-[var(--fg)]">{role.name}</h1>

                  {isSystemRole && (

                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--fg-secondary)]">

                      <Lock className="w-3 h-3"/>

                      {t('systemRoleBadgeLabel')}

                    </span>

                  )}

                </div>

                {role.description && (

                  <p className="text-sm text-[var(--fg-muted)]">{role.description}</p>

                )}

                {readOnly && (

                  <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] p-3 text-sm text-[var(--warning-text)]">

                    <Lock className="w-4 h-4 mt-0.5 shrink-0"/>

                    <span>{t('protectedSystemRoleReadOnlyHint')}</span>

                  </div>

                )}

              </div>

              <RolePermissionEditor

                roleId={role.id}

                tenantId={tenantId}

                roleName={role.name}

                readOnly={readOnly}

              />

            </>

          )}

        </main>

      </PermissionGuard>

    </ErrorBoundary>

  )

}

