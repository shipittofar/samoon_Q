import type { QRExperience } from '@/types/qr-experience'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const EXPERIENCE_MAP: Record<QRExperience['experienceType'], QRExperience> = {
  restaurant: {
    experienceType: 'restaurant',
    showMenu: true,
    showReservations: true,
    showReviews: true,
    showLoyalty: false,
    showEvents: false,
    showVendors: false,
    showLocation: false,
    showPromotions: false,
  },
  cafe: {
    experienceType: 'cafe',
    showMenu: true,
    showReservations: true,
    showReviews: true,
    showLoyalty: true,
    showEvents: false,
    showVendors: false,
    showLocation: false,
    showPromotions: false,
  },
  bar: {
    experienceType: 'bar',
    showMenu: true,
    showReservations: true,
    showReviews: false,
    showLoyalty: false,
    showEvents: true,
    showVendors: false,
    showLocation: false,
    showPromotions: true,
  },
  food_court: {
    experienceType: 'food_court',
    showMenu: true,
    showReservations: true,
    showReviews: false,
    showLoyalty: false,
    showEvents: false,
    showVendors: true,
    showLocation: false,
    showPromotions: false,
  },
  food_truck: {
    experienceType: 'food_truck',
    showMenu: true,
    showReservations: false,
    showReviews: true,
    showLoyalty: false,
    showEvents: false,
    showVendors: false,
    showLocation: true,
    showPromotions: false,
  },
  mobile_cafe: {
    experienceType: 'mobile_cafe',
    showMenu: true,
    showReservations: false,
    showReviews: true,
    showLoyalty: true,
    showEvents: false,
    showVendors: false,
    showLocation: true,
    showPromotions: false,
  },
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function isKnownExperienceType(type: string): type is QRExperience['experienceType'] {
  return type in EXPERIENCE_MAP
}

export const qrExperienceService = {
  getExperienceForBusinessType(businessType: string): QRExperience {
    if (isKnownExperienceType(businessType)) {
      return { ...EXPERIENCE_MAP[businessType] }
    }
    return { ...EXPERIENCE_MAP.restaurant }
  },

  async getQRExperience(businessType?: string): Promise<QRExperience> {
    if (USE_MOCK) {
      await delay(100)
      const type = businessType && isKnownExperienceType(businessType) ? businessType : 'restaurant'
      return { ...EXPERIENCE_MAP[type] }
    }
    const type = businessType && isKnownExperienceType(businessType) ? businessType : 'restaurant'
    return { ...EXPERIENCE_MAP[type] }
  },
}
