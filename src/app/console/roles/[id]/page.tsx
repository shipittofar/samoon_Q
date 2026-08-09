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

      <PermissionGuard permission="staff.view" fallback={<AccessDenied />}>

        <main className="p-6 space-y-6 max-w-4xl">

          <Link

            href="/console/roles"

            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"

          >

            <ArrowLeft className="w-4 h-4" />

            {t('backToRolesLabel')}

          </Link>



          {isLoading ? (

            <p className="text-sm text-gray-500">{t('loadingEllipsis')}</p>

          ) : !role ? (

            <p className="text-sm text-gray-500">{t('roleNotFound')}</p>

          ) : (

            <>

              <div className="space-y-2">

                <div className="flex flex-wrap items-center gap-2">

                  <h1 className="text-2xl font-bold text-gray-900">{role.name}</h1>

                  {isSystemRole && (

                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">

                      <Lock className="w-3 h-3" />

                      {t('systemRoleBadgeLabel')}

                    </span>

                  )}

                </div>

                {role.description && (

                  <p className="text-sm text-gray-500">{role.description}</p>

                )}

                {readOnly && (

                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">

                    <Lock className="w-4 h-4 mt-0.5 shrink-0" />

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

