import toast from 'react-hot-toast'
import { AddressProfileIncompleteError } from '@/lib/address-profile'

type Translate = (key: string) => string

/** Shared handler for address mutation failures — surfaces profile gaps without sending bad requests. */
export function handleAddressMutationError(error: unknown, t: Translate): boolean {
  if (error instanceof AddressProfileIncompleteError) {
    toast.error(t('profileIncomplete'))
    return true
  }
  return false
}
