import { describe, it, expect } from 'vitest'
import {
  canOrderFromTenant,
  coerceTenantIsActive,
  isTenantClosed,
  isTenantInactive,
  isTenantOperational,
  isTenantVisible,
  normalizeTenantStatus,
} from '@/lib/tenant-state'

describe('tenant-state contract', () => {
  it('normalizes legacy and canonical status values', () => {
    expect(normalizeTenantStatus('ACTIVE')).toBe('ACTIVE')
    expect(normalizeTenantStatus('active')).toBe('ACTIVE')
    expect(normalizeTenantStatus('trial')).toBe('ACTIVE')
    expect(normalizeTenantStatus('INACTIVE')).toBe('INACTIVE')
    expect(normalizeTenantStatus('inactive')).toBe('INACTIVE')
    expect(normalizeTenantStatus('CLOSED')).toBe('CLOSED')
    expect(normalizeTenantStatus('suspended')).toBe('CLOSED')
    expect(normalizeTenantStatus('archived')).toBe('CLOSED')
  })

  it('uses is_active for visibility, never status', () => {
    expect(isTenantVisible({ is_active: true })).toBe(true)
    expect(isTenantVisible({ is_active: false })).toBe(false)
    expect(isTenantVisible({ is_active: true })).toBe(true)
    // Hidden but operationally ACTIVE
    expect(isTenantVisible({ is_active: false })).toBe(false)
    expect(isTenantOperational({ status: 'ACTIVE' })).toBe(true)
  })

  it('uses status for operational state', () => {
    expect(isTenantOperational({ status: 'ACTIVE' })).toBe(true)
    expect(isTenantOperational({ status: 'INACTIVE' })).toBe(false)
    expect(isTenantInactive({ status: 'INACTIVE' })).toBe(true)
    expect(isTenantClosed({ status: 'CLOSED' })).toBe(true)
    expect(canOrderFromTenant({ status: 'ACTIVE' })).toBe(true)
    expect(canOrderFromTenant({ status: 'INACTIVE' })).toBe(false)
    expect(canOrderFromTenant({ status: 'CLOSED' })).toBe(false)
  })

  it('coerceTenantIsActive does not treat ACTIVE as visible by itself', () => {
    expect(coerceTenantIsActive(undefined, 'ACTIVE')).toBe(true)
    expect(coerceTenantIsActive(undefined, 'active')).toBe(true)
    expect(coerceTenantIsActive(false, 'ACTIVE')).toBe(false)
    expect(coerceTenantIsActive(true, 'INACTIVE')).toBe(true)
    expect(coerceTenantIsActive(undefined, 'archived')).toBe(false)
  })
})
