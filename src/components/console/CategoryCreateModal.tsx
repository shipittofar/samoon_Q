'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CategoryFormFields } from '@/components/console/CategoryFormFields'
import { EMPTY_CATEGORY_FORM, validateCategoryForm } from '@/lib/category-form'
import { categoryFormToWriteRequest } from '@/types'
import { withUploadedImage } from '@/lib/image-asset-write'
import type { Category } from '@/types'
import { useCreateCategory } from '@/hooks'

export interface CategoryCreateModalProps {
  open: boolean
  onClose: () => void
  branchId: string
  tenantId?: string
  onSuccess?: (category: Category) => void
  /** Show success toast when opened inline from another form (e.g. Add Menu Item). */
  showSuccessToast?: boolean
  /** Stack above an already-open modal (e.g. Add Menu Item). */
  zIndex?: number
}

export function CategoryCreateModal({
  open,
  onClose,
  branchId,
  tenantId,
  onSuccess,
  showSuccessToast = false,
  zIndex = 50,
}: CategoryCreateModalProps) {
  const t = useTranslations('console')
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM)
  const [validationError, setValidationError] = useState<string | null>(null)
  const createMutation = useCreateCategory(branchId)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_CATEGORY_FORM)
      setValidationError(null)
    }
  }, [open])

  const handleClose = () => {
    if (createMutation.isPending) return
    onClose()
  }

  const submit = async () => {
    if (createMutation.isPending || !branchId) return
    const err = validateCategoryForm(form)
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError(null)
    createMutation.mutate(
      await withUploadedImage(categoryFormToWriteRequest(form), form.image, 'menu_category', {
        tenantId,
        branchId,
        entityType: 'branch',
        entityId: branchId,
      }),
      {
      onSuccess: (category) => {
        if (showSuccessToast) {
          toast.success(t('categoryCreatedSuccessfully', { name: category.name }))
        }
        onSuccess?.(category)
        onClose()
        setForm(EMPTY_CATEGORY_FORM)
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('addCategory')}
      size="md"
      zIndex={zIndex}
    >
      <CategoryFormFields form={form} onChange={setForm} error={validationError} />
      <div className="flex gap-3 pt-2">
        <Button variant="secondary"onClick={handleClose} disabled={createMutation.isPending} className="flex-1">
          {t('cancel')}
        </Button>
        <Button onClick={submit} disabled={createMutation.isPending || !branchId} className="flex-1">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : t('addCategory')}
        </Button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToCreateCategoryRetry')}</p>
      )}
    </Modal>
  )
}
