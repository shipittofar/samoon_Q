/**
 * Branch create wizard: create only on explicit final action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test/test-utils'
import NewBranchPage from '@/app/console/branches/new/page'
import { tenantService } from '@/services/tenant.service'
import type { Tenant } from '@/types'
import * as fs from 'fs'
import * as path from 'path'

const createMutate = vi.hoisted(() => vi.fn())

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/address/MapSelector', () => ({
  MapSelector: () => <div data-testid="map-selector" />,
}))

vi.mock('@/components/ImageUploader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ImageUploader')>()
  return {
    ...actual,
    ImageUploader: ({
      value,
      onChange,
      label,
    }: {
      value: { file: File | null; existingUrl: string; cleared: boolean }
      onChange: (next: { file: File | null; existingUrl: string; cleared: boolean }) => void
      label?: string
    }) => (
      <label>
        {label}
        <input
          type="file"
          aria-label={label ?? 'upload'}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange({ ...value, file, cleared: false })
          }}
        />
      </label>
    ),
  }
})

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useConsoleTenantId: () => 'tenant-samoon-01',
    useConsoleCreateBranch: () => ({
      mutate: createMutate,
      isPending: false,
    }),
    useReverseGeocode: () => ({ mutate: vi.fn() }),
  }
})

const ROOT = path.resolve(__dirname, '../..')

window.scrollTo = vi.fn()

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return renderWithIntl(
    <QueryClientProvider client={qc}>
      <NewBranchPage />
    </QueryClientProvider>,
  )
}

async function goToFinalStep(view: ReturnType<typeof renderWizard>) {
  fireEvent.change(view.getByLabelText(/name/i), { target: { value: 'Downtown' } })
  fireEvent.click(view.getByTestId('branch-wizard-next'))

  fireEvent.change(view.getByLabelText(/address/i), { target: { value: '1 Main' } })
  fireEvent.change(view.getByLabelText(/city/i), { target: { value: 'NYC' } })
  fireEvent.change(view.getByLabelText(/country/i), { target: { value: 'US' } })
  fireEvent.click(view.getByTestId('branch-wizard-next'))

  fireEvent.click(view.getByTestId('branch-wizard-next'))
  fireEvent.click(view.getByTestId('branch-wizard-next'))
  fireEvent.click(view.getByTestId('branch-wizard-next'))

  await waitFor(() => expect(view.getByTestId('branch-wizard-create')).toBeTruthy())
  await waitFor(() => expect(view.getByRole('button', { name: 'WiFi' })).toBeTruthy())
  await waitFor(() => expect(view.getByRole('button', { name: 'Italian' })).toBeTruthy(), {
    timeout: 4000,
  })
}

describe('Branch create wizard submission', () => {
  beforeEach(() => {
    createMutate.mockReset()
    vi.spyOn(tenantService, 'getTenantById').mockResolvedValue({
      id: 'tenant-samoon-01',
      name: 'Restaurant A',
      slug: 'samoon',
      businessTypes: ['restaurant'],
    } as Tenant)
  })

  it('does not call create when the page / first step renders', () => {
    renderWizard()
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('does not call create when entering the final step via Next', async () => {
    const view = renderWizard()
    await goToFinalStep(view)
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('does not call create when changing cuisines or amenities', async () => {
    const view = renderWizard()
    await goToFinalStep(view)
    fireEvent.click(view.getByRole('button', { name: /Italian/i }))
    fireEvent.click(view.getByRole('button', { name: /WiFi/i }))
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('does not call create when selecting an image on the media step', async () => {
    const view = renderWizard()
    fireEvent.change(view.getByLabelText(/name/i), { target: { value: 'Downtown' } })
    fireEvent.click(view.getByTestId('branch-wizard-next'))
    fireEvent.change(view.getByLabelText(/address/i), { target: { value: '1 Main' } })
    fireEvent.change(view.getByLabelText(/city/i), { target: { value: 'NYC' } })
    fireEvent.change(view.getByLabelText(/country/i), { target: { value: 'US' } })
    fireEvent.click(view.getByTestId('branch-wizard-next'))
    fireEvent.click(view.getByTestId('branch-wizard-next'))

    const fileInputs = view.container.querySelectorAll('input[type="file"]')
    expect(fileInputs.length).toBeGreaterThan(0)
    const file = new File([new Uint8Array(64)], 'logo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInputs[0]!, { target: { files: [file] } })
    expect(createMutate).not.toHaveBeenCalled()
  })

  it('calls create exactly once on explicit Create Branch', async () => {
    const view = renderWizard()
    await goToFinalStep(view)
    fireEvent.click(view.getByRole('button', { name: /Italian/i }))
    fireEvent.click(view.getByRole('button', { name: /WiFi/i }))
    fireEvent.click(view.getByTestId('branch-wizard-create'))
    expect(createMutate).toHaveBeenCalledTimes(1)
    const payload = createMutate.mock.calls[0]![0]
    expect(payload.cuisines).toContain('Italian')
    expect(payload.amenities).toContain('WiFi')
  })

  it('does not create twice on double-click', async () => {
    const view = renderWizard()
    await goToFinalStep(view)
    const btn = view.getByTestId('branch-wizard-create')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(createMutate).toHaveBeenCalledTimes(1)
  })

  it('unlocks after a failed create so retry is possible', async () => {
    createMutate.mockImplementation((_payload: unknown, opts?: { onError?: (err: Error) => void }) => {
      opts?.onError?.(new Error('nope'))
    })
    const view = renderWizard()
    await goToFinalStep(view)
    fireEvent.click(view.getByTestId('branch-wizard-create'))
    expect(createMutate).toHaveBeenCalledTimes(1)
    fireEvent.click(view.getByTestId('branch-wizard-create'))
    expect(createMutate).toHaveBeenCalledTimes(2)
  })

  it('create button is type=button, never native submit', async () => {
    const view = renderWizard()
    await goToFinalStep(view)
    expect(view.getByTestId('branch-wizard-create').getAttribute('type')).toBe('button')
  })

  it('wizard page has no useEffect that creates a branch', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/app/console/branches/new/page.tsx'), 'utf8')
    expect(src).not.toMatch(/useEffect\s*\(/)
    expect(src).toContain('type="button"')
    expect(src).toContain('submitCreate')
    expect(src).not.toMatch(/type="submit"/)
  })
})
