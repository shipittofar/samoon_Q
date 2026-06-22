'use client'

import Link from 'next/link'
import { useTenantTemplates } from '@/hooks'
import type { TenantTemplate } from '@/types/provisioning'

function TemplateCard({ template }: { template: TenantTemplate }) {
  return (
    <div className="border rounded-lg p-4" aria-label={`${template.name} template`}>
      <h3 className="font-semibold text-lg">{template.name}</h3>
      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
      <ul className="mt-3 space-y-1">
        {template.enabledCapabilities.map((cap) => (
          <li key={cap} className="text-sm text-green-700 flex items-center gap-1">
            <span aria-hidden="true">✓</span> {cap.replace(/_/g, ' ')}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminTenantsPage() {
  const { data: templates, isLoading } = useTenantTemplates()

  return (
    <main aria-label="Tenant Management" className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and provision tenants</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover"
          aria-label="Create new tenant"
        >
          + New Tenant
        </Link>
      </div>

      <section aria-label="Available Templates">
        <h2 className="text-lg font-semibold mb-4">Business Type Templates</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading templates…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map((t) => <TemplateCard key={t.businessType} template={t} />)}
          </div>
        )}
      </section>
    </main>
  )
}
