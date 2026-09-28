import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { renderWithIntl } from '@/test/test-utils'
import { useIdempotencyKeys, useSubmissionGuard } from '@/hooks/use-submission-guard'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function SaveHarness({
  upload,
  save,
  onStale,
}: {
  upload: () => Promise<void>
  save: () => Promise<void>
  onStale?: () => void
}) {
  const guard = useSubmissionGuard('save-harness')
  const [log, setLog] = useState<string[]>([])
  const submit = () => {
    void guard.run(async ({ isCurrent }) => {
      setLog((prev) => [...prev, 'start'])
      await upload()
      if (!isCurrent()) {
        onStale?.()
        return
      }
      await save()
      if (!isCurrent()) {
        onStale?.()
        return
      }
      setLog((prev) => [...prev, 'done'])
    })
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <button type="submit" disabled={guard.locked}>
        {guard.locked ? 'saving' : 'save'}
      </button>
      <output>{log.join(',')}</output>
    </form>
  )
}

describe('useSubmissionGuard', () => {
  it('rejects a second submit while the upload is still running', async () => {
    const gate = deferred<void>()
    const save = vi.fn(async () => {})
    const view = renderWithIntl(
      <SaveHarness upload={() => gate.promise} save={save} />,
    )
    const button = view.getByRole('button', { name: 'save' })

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('saving')
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      gate.resolve()
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(button).not.toBeDisabled()
  })

  it('treats Enter submits as the same lock', async () => {
    const gate = deferred<void>()
    const save = vi.fn(async () => {})
    const view = renderWithIntl(
      <SaveHarness upload={() => gate.promise} save={save} />,
    )
    const form = view.container.querySelector('form')!

    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(view.getByRole('button')).toBeDisabled()
    await act(async () => {
      gate.resolve()
    })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('releases the lock on the same instance after failure and allows one retry', async () => {
    const save = vi.fn(async () => {})
    let attempts = 0
    const view = renderWithIntl(
      <SaveHarness
        upload={async () => {
          attempts += 1
          if (attempts === 1) throw new Error('upload failed')
        }}
        save={save}
      />,
    )
    fireEvent.click(view.getByRole('button'))
    await act(async () => {})
    expect(view.getByRole('button')).not.toBeDisabled()
    expect(save).not.toHaveBeenCalled()

    fireEvent.click(view.getByRole('button'))
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('releases the lock when the business write fails and keeps a later retry to one operation', async () => {
    const save = vi.fn(async () => {
      throw new Error('create failed')
    })
    const view = renderWithIntl(
      <SaveHarness upload={async () => {}} save={save} />,
    )
    fireEvent.click(view.getByRole('button'))
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
    expect(view.getByRole('button')).not.toBeDisabled()

    save.mockResolvedValueOnce(undefined)
    fireEvent.click(view.getByRole('button'))
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale completion after invalidate', async () => {
    const gate = deferred<void>()
    const save = vi.fn(async () => {})
    const stale = vi.fn()
    function Harness() {
      const guard = useSubmissionGuard('replace-harness')
      return (
        <>
          <button
            type="button"
            onClick={() => {
              void guard.run(async ({ isCurrent }) => {
                await gate.promise
                if (!isCurrent()) {
                  stale()
                  return
                }
                await save()
              })
            }}
          >
            start
          </button>
          <button type="button" onClick={() => guard.invalidate()}>
            replace
          </button>
        </>
      )
    }
    const view = renderWithIntl(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'start' }))
    fireEvent.click(view.getByRole('button', { name: 'replace' }))
    await act(async () => {
      gate.resolve()
    })
    expect(stale).toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('blocks a remounted screen until the original operation settles', async () => {
    const gate = deferred<void>()
    const save = vi.fn(async () => {})
    const view = renderWithIntl(
      <SaveHarness upload={() => gate.promise} save={save} />,
    )
    fireEvent.click(view.getByRole('button', { name: 'save' }))
    view.unmount()

    const remounted = renderWithIntl(
      <SaveHarness upload={async () => {}} save={save} />,
    )
    const button = remounted.getByRole('button')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(save).not.toHaveBeenCalled()

    await act(async () => {
      gate.resolve()
    })
    expect(remounted.getByRole('button')).not.toBeDisabled()
  })
})

describe('useIdempotencyKeys', () => {
  it('reuses a key for the same file and rotates it when the file changes', () => {
    let api: ReturnType<typeof useIdempotencyKeys> | null = null
    function Harness() {
      api = useIdempotencyKeys()
      return null
    }
    renderWithIntl(<Harness />)
    const file = new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: 1 })
    const again = new File(['a'], 'a.jpg', { type: 'image/jpeg', lastModified: 1 })
    const other = new File(['b'], 'b.jpg', { type: 'image/jpeg', lastModified: 2 })
    const first = api!.keyFor('slot', file)
    const second = api!.keyFor('slot', again)
    const third = api!.keyFor('slot', other)
    expect(second).toBe(first)
    expect(third).not.toBe(first)
    api!.reset()
  })
})
