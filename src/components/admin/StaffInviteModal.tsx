'use client'

/**
 * Console Staff — D2 invite form with canonical initial assignment fields.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import {
  AssignmentFormFields,
  emptyAssignmentForm,
  requiresAssignmentLocations,
  type AssignmentFormState,
} from '@/components/admin/AssignmentFormFields'
import { useInviteStaff } from '@/hooks'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface StaffInviteModalProps {
  tenantId: string
  open: boolean
  onClose: () => void
}

export function StaffInviteModal({ tenantId, open, onClose }: StaffInviteModalProps) {
  const t = useTranslations('console')
  const inviteStaff = useInviteStaff(tenantId)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [form, setForm] = useState<AssignmentFormState>(emptyAssignmentForm())
  const [errors, setErrors] = useState<{ email?: string; role?: string; locations?: string }>({})

  function reset() {
    setEmail('')
    setFirstName('')
    setLastName('')
    setForm(emptyAssignmentForm())
    setErrors({})
  }

  function handleClose() {
    reset()
    onClose()
  }

  function validate(): boolean {
    const next: typeof errors = {}
    const trimmedEmail = email.trim()
    if (!trimmedEmail) next.email = t('emailRequiredError')
    else if (!EMAIL_RE.test(trimmedEmail)) next.email = t('invalidEmailError')
    if (!form.roleId) next.role = t('roleRequiredError')
    if (requiresAssignmentLocations(form.allLocations, form.locationIds)) {
      next.locations = t('branchRequiredForRoleError')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (inviteStaff.isPending) return
    if (!validate()) return

    inviteStaff.mutate(
      {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role_id: form.roleId,
        location_ids: form.allLocations ? [] : form.locationIds,
        all_locations: form.allLocations,
        mode: form.mode,
        valid_from: form.validFrom || null,
        valid_until: form.validUntil || null,
      },
      {
        onSuccess: () => {
          toast.success(t('inviteSentSuccessfully'))
          handleClose()
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err, t('failedToSendInviteRetry')))
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('inviteStaffModalTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="staff-invite-email" className="block text-sm font-medium mb-1.5">
            {t('emailLabel')}
          </label>
          <input
            id="staff-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="name@example.com"
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="staff-invite-first-name" className="block text-sm font-medium mb-1.5">
              {t('firstNameLabel')}
            </label>
            <input
              id="staff-invite-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="staff-invite-last-name" className="block text-sm font-medium mb-1.5">
              {t('lastNameLabel')}
            </label>
            <input
              id="staff-invite-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <AssignmentFormFields
          tenantId={tenantId}
          form={form}
          onChange={setForm}
          roleError={errors.role}
          locationsError={errors.locations}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={inviteStaff.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {inviteStaff.isPending ? t('sendingInviteEllipsis') : t('sendInviteLabel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
