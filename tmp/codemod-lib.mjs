// Files whose colours are intentional and must not be rewritten.
export const SKIP_FILES = [
  'src\\test\\',
  'src\\app\\globals.css',
  'src\\lib\\tokens.ts',
  'src\\lib\\brand-color.ts',
  'src\\types\\website-builder.ts',       // opinionated template themes
  'src\\config\\branding-defaults.ts',    // curated brand palette catalogue
]

// Lines that must be preserved verbatim.
export const SKIP_LINE_PATTERNS = [
  // Samoon's own wordmark gradient — a logo is a brand asset, not a UI role.
  /from-orange-400 to-orange-600/,
  // Colour-name-keyed lookup maps: `orange: 'bg-orange-100 …'`is a palette
  // entry for categories/tags, not a semantic role.
  /^\s*(?:orange|red|green|blue|amber|purple|emerald|gray|slate|pink|indigo|yellow|cyan|teal|rose|violet|stone|zinc|neutral|sky|lime|fuchsia)\s*:\s*['"`]/,
]

/** [regex, replacement]. `$1`carries an optional `/opacity`suffix. */
export const RULES = [
  // ── Brand: orange -> accent ───────────────────────────────────────────────
  // Dark-mode brand companions are dropped: the accent tokens are already
  // theme-aware, so a `dark:`twin would now fight them.
  [/\s*\bdark:(?:bg|text|border|ring|from|to|via|divide|placeholder|shadow)-orange-(?:200|300|700|800|900|950)(?:\/\d+)?\b/g, ''],

  [/\bhover:bg-orange-(?:600|700)(\/\d+)?\b/g, 'hover:bg-[var(--accent-hover)]$1'],
  [/\bactive:bg-orange-(?:700|800)(\/\d+)?\b/g, 'active:bg-[var(--accent-active)]$1'],
  [/\bhover:bg-orange-(?:50|100)(\/\d+)?\b/g, 'hover:bg-[var(--accent-subtle)]$1'],
  [/\bhover:bg-orange-500(\/\d+)?\b/g, 'hover:bg-[var(--accent-hover)]$1'],
  [/\bgroup-hover:bg-orange-(?:500|600)(\/\d+)?\b/g, 'group-hover:bg-[var(--accent-hover)]$1'],
  [/\bbg-orange-(?:500|600)(\/\d+)?\b/g, 'bg-[var(--accent)]$1'],
  [/\bbg-orange-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--accent-subtle)]$1'],

  [/\bhover:text-orange-(?:500|600|700)(\/\d+)?\b/g, 'hover:text-[var(--accent-text)]$1'],
  [/\bgroup-hover:text-orange-(?:500|600|700)(\/\d+)?\b/g, 'group-hover:text-[var(--accent-text)]$1'],
  [/\btext-orange-(?:500|600|700|800)(\/\d+)?\b/g, 'text-[var(--accent-text)]$1'],

  [/\bhover:border-orange-(?:100|200|300|500|600)(\/\d+)?\b/g, 'hover:border-[var(--accent-border)]/50'],
  [/\bfocus:border-orange-(?:400|500|600)\b/g, 'focus:border-[var(--focus-ring)]'],
  [/\bborder-orange-(?:500|600|700)(\/\d+)?\b/g, 'border-[var(--accent-border)]$1'],
  [/\bborder-orange-(?:100|200|300)(\/\d+)?\b/g, 'border-[var(--accent-border)]/40'],

  [/\b(focus-visible|focus|group-focus):ring-orange-(?:300|400|500|600)(\/\d+)?\b/g, '$1:ring-[var(--focus-ring)]$2'],
  [/\bring-orange-(?:300|400|500|600)(\/\d+)?\b/g, 'ring-[var(--focus-ring)]$1'],
  [/\bshadow-orange-(?:500|600)(\/\d+)?\b/g, 'shadow-[var(--accent)]$1'],
  [/\baccent-orange-(?:500|600)\b/g, 'accent-[var(--accent)]'],
  [/\bfrom-orange-(?:500|600)(\/\d+)?\b/g, 'from-[var(--accent)]$1'],
  [/\bto-orange-(?:500|600|700)(\/\d+)?\b/g, 'to-[var(--accent-active)]$1'],
  [/\bvia-orange-(?:500|600)(\/\d+)?\b/g, 'via-[var(--accent)]$1'],
  [/\bdivide-orange-(?:200|300)(\/\d+)?\b/g, 'divide-[var(--accent-border)]/40'],

  // ── Neutrals: gray -> foreground / surface / border ramp ──────────────────
  [/\s*\bdark:(?:bg|text|border|divide|placeholder)-(?:gray|slate|zinc|neutral)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?\b/g, ''],
  [/\s*\bdark:bg-white(?:\/\d+)?\b/g, ''],

  [/\bhover:text-(?:gray|slate|zinc|neutral)-(?:700|800|900)\b/g, 'hover:text-[var(--fg)]'],
  [/\bhover:text-(?:gray|slate|zinc|neutral)-(?:500|600)\b/g, 'hover:text-[var(--fg-muted)]'],
  [/\bgroup-hover:text-(?:gray|slate|zinc|neutral)-(?:700|800|900)\b/g, 'group-hover:text-[var(--fg)]'],
  [/\btext-(?:gray|slate|zinc|neutral)-(?:800|900|950)(\/\d+)?\b/g, 'text-[var(--fg)]$1'],
  [/\btext-(?:gray|slate|zinc|neutral)-700(\/\d+)?\b/g, 'text-[var(--fg-secondary)]$1'],
  [/\btext-(?:gray|slate|zinc|neutral)-(?:500|600)(\/\d+)?\b/g, 'text-[var(--fg-muted)]$1'],
  [/\btext-(?:gray|slate|zinc|neutral)-(?:300|400)(\/\d+)?\b/g, 'text-[var(--fg-subtle)]$1'],
  [/\bplaceholder:?-?text?-?(?:gray|slate|zinc|neutral)-(?:300|400|500)\b/g, 'placeholder:text-[var(--fg-subtle)]'],

  [/\bhover:bg-(?:gray|slate|zinc|neutral)-(?:50|100|200)(\/\d+)?\b/g, 'hover:bg-[var(--card-hover)]$1'],
  [/\bhover:bg-(?:gray|slate|zinc|neutral)-(?:700|800)(\/\d+)?\b/g, 'hover:bg-[var(--card-hover)]$1'],
  [/\bbg-(?:gray|slate|zinc|neutral)-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--card-hover)]$1'],
  [/\bbg-(?:gray|slate|zinc|neutral)-200(\/\d+)?\b/g, 'bg-[var(--border)]$1'],
  [/\bbg-(?:gray|slate|zinc|neutral)-(?:800|900|950)(\/\d+)?\b/g, 'bg-[var(--card)]$1'],

  [/\bhover:border-(?:gray|slate|zinc|neutral)-(?:300|400)\b/g, 'hover:border-[var(--border-input)]'],
  [/\bborder-(?:gray|slate|zinc|neutral)-(?:100|200)(\/\d+)?\b/g, 'border-[var(--border)]$1'],
  [/\bborder-(?:gray|slate|zinc|neutral)-(?:300|400)(\/\d+)?\b/g, 'border-[var(--border-strong)]$1'],
  [/\bborder-(?:gray|slate|zinc|neutral)-(?:700|800)(\/\d+)?\b/g, 'border-[var(--border)]$1'],
  [/\bdivide-(?:gray|slate|zinc|neutral)-(?:100|200)(\/\d+)?\b/g, 'divide-[var(--border)]$1'],

  // Opaque white panels are surfaces; translucent `bg-white/40`overlays sit
  // on top of imagery and are left as-is.
  [/\bbg-white(?![\/\w-])/g, 'bg-[var(--card)]'],

  // ── Feedback: danger ──────────────────────────────────────────────────────
  [/\s*\bdark:(?:bg|text|border)-red-(?:200|300|400|500|700|800|900|950)(?:\/\d+)?\b/g, ''],
  [/\bhover:bg-red-(?:600|700)(\/\d+)?\b/g, 'hover:bg-[var(--danger-hover)]$1'],
  [/\bhover:text-red-(?:600|700)\b/g, 'hover:text-[var(--danger-text)]'],
  [/\bhover:bg-red-(?:50|100)(\/\d+)?\b/g, 'hover:bg-[var(--danger-subtle)]$1'],
  [/\bbg-red-(?:500|600|700)(\/\d+)?\b/g, 'bg-[var(--danger)]$1'],
  [/\bbg-red-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--danger-subtle)]$1'],
  [/\btext-red-(?:500|600|700|800)(\/\d+)?\b/g, 'text-[var(--danger-text)]$1'],
  [/\bborder-red-(?:400|500|600)(\/\d+)?\b/g, 'border-[var(--danger)]$1'],
  [/\bborder-red-(?:100|200|300)(\/\d+)?\b/g, 'border-[var(--danger-border)]$1'],
  [/\b(focus-visible|focus):ring-red-(?:400|500)(\/\d+)?\b/g, '$1:ring-[var(--danger)]$2'],
  [/\bring-red-(?:400|500)(\/\d+)?\b/g, 'ring-[var(--danger)]$1'],

  // ── Feedback: success ─────────────────────────────────────────────────────
  [/\s*\bdark:(?:bg|text|border)-(?:emerald|green)-(?:200|300|400|500|700|800|900|950)(?:\/\d+)?\b/g, ''],
  [/\bhover:bg-(?:emerald|green)-(?:600|700)(\/\d+)?\b/g, 'hover:bg-[var(--success-hover)]$1'],
  [/\bbg-(?:emerald|green)-(?:500|600|700)(\/\d+)?\b/g, 'bg-[var(--success)]$1'],
  [/\bbg-(?:emerald|green)-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--success-subtle)]$1'],
  [/\btext-(?:emerald|green)-(?:500|600|700|800)(\/\d+)?\b/g, 'text-[var(--success-text)]$1'],
  [/\bborder-(?:emerald|green)-(?:400|500|600)(\/\d+)?\b/g, 'border-[var(--success)]$1'],
  [/\bborder-(?:emerald|green)-(?:100|200|300)(\/\d+)?\b/g, 'border-[var(--success-border)]$1'],

  // ── Feedback: warning ─────────────────────────────────────────────────────
  [/\s*\bdark:(?:bg|text|border)-(?:amber|yellow)-(?:200|300|400|500|700|800|900|950)(?:\/\d+)?\b/g, ''],
  [/\bhover:bg-(?:amber|yellow)-(?:600|700)(\/\d+)?\b/g, 'hover:bg-[var(--warning-hover)]$1'],
  [/\bbg-(?:amber|yellow)-(?:500|600|700)(\/\d+)?\b/g, 'bg-[var(--warning)]$1'],
  [/\bbg-(?:amber|yellow)-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--warning-subtle)]$1'],
  [/\btext-(?:amber|yellow)-(?:600|700|800)(\/\d+)?\b/g, 'text-[var(--warning-text)]$1'],
  [/\bborder-(?:amber|yellow)-(?:400|500|600)(\/\d+)?\b/g, 'border-[var(--warning)]$1'],
  [/\bborder-(?:amber|yellow)-(?:100|200|300)(\/\d+)?\b/g, 'border-[var(--warning-border)]$1'],

  // ── Feedback: info ────────────────────────────────────────────────────────
  [/\s*\bdark:(?:bg|text|border)-(?:blue|sky)-(?:200|300|400|500|700|800|900|950)(?:\/\d+)?\b/g, ''],
  [/\bhover:bg-(?:blue|sky)-(?:600|700)(\/\d+)?\b/g, 'hover:bg-[var(--info-hover)]$1'],
  [/\bbg-(?:blue|sky)-(?:500|600|700)(\/\d+)?\b/g, 'bg-[var(--info)]$1'],
  [/\bbg-(?:blue|sky)-(?:50|100)(\/\d+)?\b/g, 'bg-[var(--info-subtle)]$1'],
  [/\btext-(?:blue|sky)-(?:500|600|700|800)(\/\d+)?\b/g, 'text-[var(--info-text)]$1'],
  [/\bborder-(?:blue|sky)-(?:400|500|600)(\/\d+)?\b/g, 'border-[var(--info)]$1'],
  [/\bborder-(?:blue|sky)-(?:100|200|300)(\/\d+)?\b/g, 'border-[var(--info-border)]$1'],
]

/**
 * `text-white`is only wrong when it sits on a token-driven fill, where the
 * readable foreground is now derived. Left alone elsewhere (text over photos,
 * gradients, fixed-colour marketing panels).
 */
export const FG_PAIRS = [
  ['--accent', '--accent-fg'],
  ['--danger', '--danger-fg'],
  ['--success', '--success-fg'],
  ['--warning', '--warning-fg'],
  ['--info', '--info-fg'],
]

export function fixForegroundOnFill(line) {
  if (!/\btext-white\b/.test(line)) return line
  for (const [fill, fg] of FG_PAIRS) {
    if (line.includes(`bg-[var(${fill})]`)) {
      return line.replace(/\btext-white\b/g, `text-[var(${fg})]`)
    }
  }
  return line
}

