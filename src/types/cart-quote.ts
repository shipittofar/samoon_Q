/** Backend cart/checkout quote — all monetary values come from the API. */
export interface PricingLine {
  key: string
  label?: string
  amount: number
}

export interface CartQuote {
  lines?: PricingLine[]
  subtotal?: number
  tax?: number
  service_charge?: number
  delivery_fee?: number
  discount?: number
  grand_total?: number
  [key: string]: unknown
}
