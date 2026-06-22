export interface QRExperience {
  experienceType:
    | 'restaurant'
    | 'cafe'
    | 'bar'
    | 'food_court'
    | 'food_truck'
    | 'mobile_cafe'

  showMenu: boolean
  showReservations: boolean
  showReviews: boolean
  showLoyalty: boolean
  showEvents: boolean
  showVendors: boolean
  showLocation: boolean
  showPromotions: boolean
}
