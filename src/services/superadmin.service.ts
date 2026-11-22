import api from './axios.instance'

/**
 * Platform superuser console (backend /api/superadmin/, superuser-only) plus
 * the two owner/applicant endpoints that go with it: business registration
 * requests and ready-made menu templates.
 */

export type BusinessTypeValue =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'food_truck'
  | 'food_court'
  | 'mobile_cafe'
  | 'gym'
  | 'beauty_salon'
  | 'clinic'

export const BUSINESS_TYPE_VALUES: BusinessTypeValue[] = [
  'restaurant',
  'cafe',
  'bar',
  'food_truck',
  'food_court',
  'mobile_cafe',
  'gym',
  'beauty_salon',
  'clinic',
]

export interface PlatformUserBlock {
  id: string
  phone_number: string | null
  email: string | null
  full_name: string
}

export interface PlatformOverview {
  tenants: number
  active_tenants: number
  owners: number
  users: number
  pending_business_requests: number
  menu_templates: number
}

export interface PlatformTenantRow {
  id: string
  name: string
  slug: string
  status: string
  is_active: boolean
  business_types: string[]
  created_at: string
  branch_count: number
  city: string
  owner: PlatformUserBlock | null
  owner_status: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface PlatformBranchDetail {
  id: string
  name: string
  slug: string
  status: string
  is_active: boolean
  is_default: boolean
  phone: string
  city: string
  address: string
  latitude: string | null
  longitude: string | null
  delivery_radius_km: number | null
  ordering_enabled: boolean
  delivery_enabled: boolean
  pickup_enabled: boolean
  table_ordering_enabled: boolean
  reservations_enabled: boolean
  marketplace_visible: boolean
  category_count: number
  item_count: number
  created_at: string
}

export interface PlatformTenantDetail {
  id: string
  name: string
  slug: string
  description: string
  status: string
  is_active: boolean
  business_types: string[]
  tax_percentage: string
  service_charge_percentage: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  owner: PlatformUserBlock & {
    status: string
    plan: string | null
    verified_at: string | null
    since: string
    other_tenants: { id: string; name: string }[]
  }
  counts: {
    branches: number
    categories: number
    menu_items: number
    staff: number
    orders: number
    orders_last_30_days: number
    revenue_last_30_days: string
    reservations: number
  }
  branches: PlatformBranchDetail[]
  registration_request: { id: string; created_at: string; decided_at: string | null } | null
}

export type BusinessRequestStatus = 'pending' | 'approved' | 'rejected'

export interface BusinessRequestInput {
  name: string
  business_type: BusinessTypeValue
  description?: string
  phone?: string
  city?: string
  address?: string
  latitude?: string | null
  longitude?: string | null
  service_radius_km?: number | null
}

export interface BusinessRequest extends Required<Omit<BusinessRequestInput, 'latitude' | 'longitude' | 'service_radius_km'>> {
  id: string
  status: BusinessRequestStatus
  latitude: string | null
  longitude: string | null
  service_radius_km: number | null
  rejection_reason: string
  tenant_id: string | null
  created_at: string
  decided_at: string | null
}

export interface PlatformBusinessRequest extends BusinessRequest {
  applicant: PlatformUserBlock | null
  decided_by: PlatformUserBlock | null
}

export interface MenuTemplateItem {
  name: string
  description?: string
  price: string | number
  preparation_time?: number | null
  calories?: number | null
}

export interface MenuTemplateCategory {
  name: string
  description?: string
  items: MenuTemplateItem[]
}

export interface MenuTemplate {
  id: string
  name: string
  description: string
  business_type: BusinessTypeValue
  is_active: boolean
  content: { categories: MenuTemplateCategory[] }
  category_count: number
  item_count: number
  created_at: string
  updated_at: string
}

export type MenuTemplateInput = Pick<MenuTemplate, 'name' | 'description' | 'business_type' | 'is_active' | 'content'>

export interface ApplyTemplateResult {
  created_categories: number
  created_items: number
  skipped_items: number
}

/** First readable message from a DRF error response. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  const pick = (value: unknown): string | null => {
    if (!value) return null
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return pick(value[0])
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const key of ['detail', 'message', 'non_field_errors', 'content']) {
        const found = pick(record[key])
        if (found) return found
      }
      for (const v of Object.values(record)) {
        const found = pick(v)
        if (found) return found
      }
    }
    return null
  }
  return pick(data) ?? fallback
}

export const superadminService = {
  async overview(): Promise<PlatformOverview> {
    const { data } = await api.get<PlatformOverview>('/superadmin/overview/')
    return data
  },

  async listTenants(params: {
    search?: string
    business_type?: string
    status?: string
    owner_status?: string
    page?: number
  }): Promise<Paginated<PlatformTenantRow>> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    const { data } = await api.get<Paginated<PlatformTenantRow>>('/superadmin/tenants/', { params: clean })
    return data
  },

  async getTenant(id: string): Promise<PlatformTenantDetail> {
    const { data } = await api.get<PlatformTenantDetail>(`/superadmin/tenants/${id}/`)
    return data
  },

  async listRequests(params: { status?: string; search?: string; page?: number }): Promise<Paginated<PlatformBusinessRequest>> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    const { data } = await api.get<Paginated<PlatformBusinessRequest>>('/superadmin/business-requests/', {
      params: clean,
    })
    return data
  },

  async approveRequest(id: string): Promise<PlatformBusinessRequest> {
    const { data } = await api.post<PlatformBusinessRequest>(`/superadmin/business-requests/${id}/approve/`)
    return data
  },

  async rejectRequest(id: string, reason: string): Promise<PlatformBusinessRequest> {
    const { data } = await api.post<PlatformBusinessRequest>(`/superadmin/business-requests/${id}/reject/`, {
      reason,
    })
    return data
  },

  async listTemplates(businessType?: string): Promise<MenuTemplate[]> {
    const { data } = await api.get<MenuTemplate[]>('/superadmin/menu-templates/', {
      params: businessType ? { business_type: businessType } : {},
    })
    return data
  },

  async createTemplate(input: MenuTemplateInput): Promise<MenuTemplate> {
    const { data } = await api.post<MenuTemplate>('/superadmin/menu-templates/', input)
    return data
  },

  async updateTemplate(id: string, input: Partial<MenuTemplateInput>): Promise<MenuTemplate> {
    const { data } = await api.patch<MenuTemplate>(`/superadmin/menu-templates/${id}/`, input)
    return data
  },

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/superadmin/menu-templates/${id}/`)
  },
}

export const businessRequestService = {
  async mine(): Promise<BusinessRequest[]> {
    const { data } = await api.get<BusinessRequest[]>('/tenants/business-requests/')
    return data
  },

  async create(input: BusinessRequestInput): Promise<BusinessRequest> {
    const { data } = await api.post<BusinessRequest>('/tenants/business-requests/', input)
    return data
  },
}

export const menuTemplateService = {
  async forBranch(branchId: string): Promise<MenuTemplate[]> {
    const { data } = await api.get<MenuTemplate[]>(`/menu/branches/${branchId}/templates/`)
    return data
  },

  async apply(branchId: string, templateId: string): Promise<ApplyTemplateResult> {
    const { data } = await api.post<ApplyTemplateResult>(`/menu/branches/${branchId}/templates/${templateId}/apply/`)
    return data
  },
}
