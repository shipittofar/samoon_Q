'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useExportAnalytics } from '@/hooks'
import type { ExportDomain, ExportFormat } from '@/hooks'

const DOMAINS: ExportDomain[] = ['summary', 'revenue', 'reservations', 'loyalty', 'promotions', 'vendors', 'menu']

interface AnalyticsExportProps {
  className?: string
}

export function AnalyticsExport({ className }: AnalyticsExportProps) {
  const t = useTranslations('console')
  const [domain, setDomain] = useState<ExportDomain>('summary')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const { mutate: exportData, isPending } = useExportAnalytics()

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      <select
        value={domain}
        onChange={(e) => setDomain(e.target.value as ExportDomain)}
        className="text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {DOMAINS.map((d) => (
          <option key={d} value={d}>{t(`exportDomains.${d}`)}</option>
        ))}
      </select>

      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        className="text-sm border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
        <option value="pdf">PDF (Print)</option>
      </select>

      <button
        onClick={() => exportData({ domain, format })}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {t('export')}
      </button>
    </div>
  )
}
