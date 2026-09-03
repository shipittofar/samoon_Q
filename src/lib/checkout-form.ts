import { z } from 'zod'

/**
 * Checkout contact schema.
 * Email is optional (phone-only accounts). Empty string is valid; a filled
 * value must still be a well-formed address. Do not invent a placeholder email.
 */
export const checkoutSchema = z.object({
  first_name: z.string().min(2, 'required'),
  last_name: z.string().min(2, 'required'),
  email: z.string().email('invalid_email').optional().or(z.literal('')),
  phone_number: z.string().min(10, 'invalid_phone'),
  table_number: z.string().optional(),
  notes: z.string().optional(),
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>
