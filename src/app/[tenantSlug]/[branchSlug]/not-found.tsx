import Link from 'next/link'
import { Store, ArrowLeft } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { TenantHeader } from '@/components/layout/TenantHeader'
import { Footer } from '@/components/layout/Footer'

export default async function BranchNotFound() {
  const t = await getTranslations('branch')
  const tTenant = await getTranslations('tenant')
  return (
    <>
      <TenantHeader />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <Store className="w-16 h-16 text-[var(--fg-muted)] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[var(--fg)] mb-3">{t('branchNotFound')}</h1>
        <p className="text-[var(--fg-muted)] max-w-sm mb-8">
          {t('branchNotFoundLongDesc')}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {tTenant('browseAllBusinesses')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
