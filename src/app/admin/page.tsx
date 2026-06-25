import { redirect } from 'next/navigation'

// /admin has no dashboard page — redirect to the primary operational view.
// AuthGuard in layout.tsx already enforces authentication before this runs.
export default function AdminIndexPage() {
  redirect('/admin/orders')
}
