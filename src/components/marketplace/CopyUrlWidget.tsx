'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface CopyUrlWidgetProps {
  url: string
  label?: string
}

/** Public URL display with copy and open actions. Used in admin settings and tenant homepage. */
export function CopyUrlWidget({ url, label = 'Public URL' }: CopyUrlWidgetProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border rounded px-2.5 py-1.5 text-gray-700 truncate font-mono">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy URL"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-gray-100 transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open public URL"
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-gray-100 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </a>
      </div>
      <p className="text-xs text-gray-400 mt-2">QR code generation available in the mobile app.</p>
    </div>
  )
}
