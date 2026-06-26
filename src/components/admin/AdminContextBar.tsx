'use client'

/**
 * P8.7.5 Phase H — Admin Context Bar
 *
 * Renders above the breadcrumbs in AdminLayout. Shows the active tenant and
 * branch so every admin page is always context-aware. Embeds the
 * AdminBranchSwitcher (branch dropdown) and AdminTenantSwitcher (tenant dropdown
 * for platform admins).
 */

import { AdminBranchSwitcher } from './AdminBranchSwitcher'
import { AdminTenantSwitcher } from './AdminTenantSwitcher'

export function AdminContextBar() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <AdminTenantSwitcher />
      <AdminBranchSwitcher />
    </div>
  )
}
