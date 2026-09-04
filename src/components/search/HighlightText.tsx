import { cn } from '@/utils'

interface HighlightTextProps {
  text: string
  query?: string
  className?: string
}

/** Highlights the first case-insensitive occurrence of `query` inside `text`. */
export function HighlightText({ text, query, className }: HighlightTextProps) {
  const q = query?.trim() ?? ''
  if (!q) return <span className={className}>{text}</span>

  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx < 0) return <span className={className}>{text}</span>

  return (
    <span className={className}>
      {text.slice(0, idx)}
      <mark className="bg-[var(--accent-subtle)] text-[var(--fg)] rounded-sm px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  )
}

export function highlightClassName(active?: boolean) {
  return cn(active && 'font-medium')
}
