import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'
import { cn } from '@/utils'

/**
 * Semantic table primitive — Phase 2 (P2.3).
 * All styling via CSS tokens; no hardcoded colors.
 *
 * Usage:
 *   <Table>
 *     <TableHead>
 *       <TableRow><TableHeader>Name</TableHeader></TableRow>
 *     </TableHead>
 *     <TableBody>
 *       <TableRow><TableCell>Value</TableCell></TableRow>
 *     </TableBody>
 *   </Table>
 */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border)]">
      <table
        className={cn('w-full text-sm text-[var(--fg)] border-collapse', className)}
        {...props}
      />
    </div>
  )
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-[var(--card-hover)] border-b border-[var(--border)]', className)}
      {...props}
    />
  )
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-[var(--border)] bg-[var(--card)]', className)}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-[var(--card-hover)]', className)}
      {...props}
    />
  )
}

export function TableHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-start text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 text-[var(--fg)] align-middle', className)}
      {...props}
    />
  )
}
