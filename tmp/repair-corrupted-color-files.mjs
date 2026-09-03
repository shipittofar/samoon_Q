import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { RULES, SKIP_LINE_PATTERNS, fixForegroundOnFill } from './codemod-lib.mjs'

const FILES = [
  'src/components/admin/configuration/ConfigurationStudioLayout.tsx',
  'src/components/admin/AnalyticsExport.tsx',
  'src/app/vendors/VendorsClientPage.tsx',
  'src/components/menu/MenuContent.tsx',
  'src/app/reservation/page.tsx',
  'src/components/reviews/RatingBreakdown.tsx',
  'src/components/admin/StaffPresenceBoard.tsx',
  'src/app/restaurant/page.tsx',
  'src/app/loyalty/page.tsx',
  'src/components/admin/configuration/ConfigurationInheritanceTree.tsx',
  'src/app/console/customers/[id]/reviews/page.tsx',
  'src/app/dashboard/favorites/page.tsx',
  'src/components/admin/AuditTimeline.tsx',
  'src/components/admin/BranchStatusGrid.tsx',
  'src/app/console/analytics/page.tsx',
  'src/components/admin/TenantCanonicalSettingsForm.tsx',
  'src/components/admin/RealtimeDashboardWidgets.tsx',
]

const GLOBAL_REPLACEMENTS = [
  // Undefined variables found in the post-implementation scan.
  ['bg-[var(--surface)]', 'bg-[var(--card)]'],
  ['bg-[var(--primary)]/10', 'bg-[var(--accent)]/10'],
  ['bg-[var(--primary)]', 'bg-[var(--accent)]'],
  ['text-[var(--primary)]', 'text-[var(--accent-text)]'],
  ['border-[var(--primary)]', 'border-[var(--accent-border)]'],
  ['hover:border-[var(--primary)]', 'hover:border-[var(--accent-border)]'],
  // Rating, danger and stale theme-specific companions.
  ['dark:text-orange-400', ''],
  ['dark:hover:bg-orange-950/40', ''],
  ['dark:hover:bg-orange-950/20', ''],
  ['dark:hover:border-orange-900', ''],
  ['dark:hover:bg-red-950/20', ''],
  ['dark:hover:text-red-400', ''],
  ['text-red-400', 'text-[var(--danger-text)]'],
  ['fill-amber-400', 'fill-[var(--rating)]'],
  ['text-amber-400', 'text-[var(--rating)]'],
  ['text-amber-500', 'text-[var(--rating)]'],
  ['fill-gray-300', 'fill-[var(--border-strong)]'],
  // Categorical/admin colors converted to theme-aware category roles.
  ['dark:bg-purple-950/30', ''],
  ['dark:text-purple-400', ''],
  ['dark:border-purple-800', ''],
  ['bg-purple-50', 'bg-[var(--chart-5)]/10'],
  ['bg-purple-100', 'bg-[var(--chart-5)]/15'],
  ['text-purple-500', 'text-[var(--chart-5)]'],
  ['text-purple-600', 'text-[var(--chart-5)]'],
  ['text-purple-700', 'text-[var(--chart-5)]'],
  ['border-purple-200', 'border-[var(--chart-5)]/30'],
  ['hover:bg-indigo-700', 'hover:bg-[var(--info-hover)]'],
  ['bg-indigo-600', 'bg-[var(--info)]'],
  ['bg-indigo-50', 'bg-[var(--info-subtle)]'],
  ['bg-indigo-100', 'bg-[var(--info-subtle)]'],
  ['text-indigo-600', 'text-[var(--info-text)]'],
  ['text-indigo-700', 'text-[var(--info-text)]'],
  ['border-indigo-100', 'border-[var(--info-border)]'],
  ['border-indigo-200', 'border-[var(--info-border)]'],
  ['text-gray-200', 'text-[var(--fg-disabled)]'],
]

const FILE_REPLACEMENTS = {
  'src/components/admin/configuration/ConfigurationStudioLayout.tsx': [
    ['hover:bg-orange-300/50', 'hover:bg-[var(--accent-subtle)]'],
  ],
  'src/components/admin/AnalyticsExport.tsx': [
    ['focus:ring-blue-500', 'focus:ring-[var(--focus-ring)]'],
  ],
  'src/app/vendors/VendorsClientPage.tsx': [
    ['text-yellow-400', 'text-[var(--rating)]'],
  ],
  'src/components/menu/MenuContent.tsx': [
    ['from-orange-50/80 to-transparent dark:to-transparent', 'from-[var(--accent-subtle)] to-transparent'],
  ],
  'src/app/reservation/page.tsx': [
    ['from-orange-400 to-orange-600', 'from-[var(--accent)] to-[var(--accent-active)]'],
    ['from-orange-50/80 to-transparent dark:to-transparent', 'from-[var(--accent-subtle)] to-transparent'],
  ],
  'src/components/reviews/RatingBreakdown.tsx': [
    ['bg-amber-400', 'bg-[var(--rating)]'],
  ],
  'src/components/admin/StaffPresenceBoard.tsx': [
    ["break: 'bg-yellow-400'", "break: 'bg-[var(--warning)]'"],
    ["offline: 'bg-gray-400'", "offline: 'bg-[var(--fg-subtle)]'"],
  ],
  'src/app/restaurant/page.tsx': [
    ['from-orange-900 to-stone-900', 'from-[var(--accent-active)] to-[var(--surface-sunken)]'],
    ['from-orange-50 to-orange-100', 'from-[var(--accent-subtle)] to-[var(--card-hover)]'],
    ['text-orange-400 mx-auto', 'text-[var(--accent-text)] mx-auto'],
  ],
  'src/app/loyalty/page.tsx': [
    ["gold:     'text-yellow-500'", "gold:     'text-[var(--rating)]'"],
  ],
  'src/components/admin/configuration/ConfigurationInheritanceTree.tsx': [
    ['border-orange-400', 'border-[var(--accent-border)]'],
  ],
  'src/app/console/customers/[id]/reviews/page.tsx': [
    ['text-yellow-400 fill-yellow-400', 'text-[var(--rating)] fill-[var(--rating)]'],
  ],
  'src/app/dashboard/favorites/page.tsx': [
    ['fill-red-500', 'fill-[var(--danger)]'],
  ],
  'src/components/admin/AuditTimeline.tsx': [
    ["info:     'bg-blue-400'", "info:     'bg-[var(--info)]'"],
    ["warning:  'bg-amber-400'", "warning:  'bg-[var(--warning)]'"],
  ],
  'src/components/admin/BranchStatusGrid.tsx': [
    ["degraded: 'bg-yellow-400'", "degraded: 'bg-[var(--warning)]'"],
    ["offline: 'bg-gray-400'", "offline: 'bg-[var(--fg-subtle)]'"],
  ],
  'src/app/console/analytics/page.tsx': [
    ["color: 'bg-blue-400'", "color: 'bg-[var(--info)]'"],
    ["color: 'bg-red-400'", "color: 'bg-[var(--danger)]'"],
    ["color: 'bg-green-400'", "color: 'bg-[var(--success)]'"],
  ],
  'src/components/admin/TenantCanonicalSettingsForm.tsx': [
    ['focus:ring-blue-500', 'focus:ring-[var(--focus-ring)]'],
  ],
  'src/components/admin/RealtimeDashboardWidgets.tsx': [
    ['bg-yellow-400 animate-pulse', 'bg-[var(--warning)] animate-pulse'],
  ],
}

function applyBaseCodemod(source) {
  return source
    .split('\n')
    .map((line) => {
      if (SKIP_LINE_PATTERNS.some((pattern) => pattern.test(line))) return line
      let output = line
      for (const [pattern, replacement] of RULES) {
        output = output.replace(pattern, replacement)
      }
      output = fixForegroundOnFill(output)
      return output.replace(/(["'`])[ \t]+(?=[\w[])/g, '$1')
    })
    .join('\n')
}

function pairSemanticForegrounds(source) {
  return source.replace(/(['"`])([^'"`\n]+)\1/g, (match, quote, body) => {
    let next = body
    if (next.includes('bg-[var(--accent)]') && next.includes('text-white')) {
      next = next.replaceAll('text-white', 'text-[var(--accent-fg)]')
    }
    return `${quote}${next}${quote}`
  })
}

for (const file of FILES) {
  const head = execFileSync('git', ['show', `HEAD:${file}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  let output = applyBaseCodemod(head)
  for (const [from, to] of GLOBAL_REPLACEMENTS) output = output.replaceAll(from, to)
  for (const [from, to] of FILE_REPLACEMENTS[file] ?? []) output = output.replaceAll(from, to)
  output = pairSemanticForegrounds(output)
  writeFileSync(file, output, 'utf8')
  console.log(`repaired ${file}`)
}

const corruptionPattern = /\b(?:gg-|gorder|sugtle|lagel|orom|olex|oont|og-|inoo|rrom-)/
const remaining = FILES.filter((file) => corruptionPattern.test(readFileSync(file, 'utf8')))
if (remaining.length) {
  throw new Error(`Corruption markers remain:\n${remaining.join('\n')}`)
}
console.log(`verified ${FILES.length} repaired files`)
