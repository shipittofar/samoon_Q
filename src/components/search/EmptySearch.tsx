'use client'

import { type ReactNode } from 'react'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface EmptySearchProps {
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}

export function EmptySearch({ title, description, action, children }: EmptySearchProps) {
  return (
    <div>
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title={title}
        description={description}
        action={action}
      />
      {children}
    </div>
  )
}
