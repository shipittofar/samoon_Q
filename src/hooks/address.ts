'use client'

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { addressService } from '@/services/address.service'
import { serviceabilityService } from '@/services/serviceability.service'
import { STALE_TIME } from '@/constants'
import type { AddressListParams, CheckServiceabilityPayload, UserAddressInput, UserAddressUpdateInput } from '@/types/address'

export const addressKeys = {
  all: ['addresses'] as const,
  lists: () => [...addressKeys.all, 'list'] as const,
  list: (params: AddressListParams) => [...addressKeys.lists(), params] as const,
  details: () => [...addressKeys.all, 'detail'] as const,
  detail: (id: string) => [...addressKeys.details(), id] as const,
  suggestions: (q: string) => [...addressKeys.all, 'suggestions', q] as const,
  serviceability: (key: string) => ['serviceability', key] as const,
}

const DEFAULT_PAGE_SIZE = 10

export function useAddressList(params: AddressListParams = {}) {
  return useQuery({
    queryKey: addressKeys.list(params),
    queryFn: () => addressService.list(params),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  })
}

export function useInfiniteAddresses(search = '', includeDeleted = false) {
  return useInfiniteQuery({
    queryKey: addressKeys.list({ search, include_deleted: includeDeleted, page_size: DEFAULT_PAGE_SIZE }),
    queryFn: ({ pageParam = 1 }) =>
      addressService.list({
        page: pageParam,
        page_size: DEFAULT_PAGE_SIZE,
        search: search || undefined,
        include_deleted: includeDeleted,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      if (!last.next) return undefined
      const match = last.next.match(/page=(\d+)/)
      return match ? Number(match[1]) : undefined
    },
    staleTime: STALE_TIME,
  })
}

/** @deprecated Use useAddressList — kept for backward compatibility */
export function useAddresses() {
  const query = useAddressList({ page_size: 50 })
  return {
    ...query,
    data: query.data?.results ?? [],
  }
}

export function useAddress(id: string | null) {
  return useQuery({
    queryKey: addressKeys.detail(id ?? ''),
    queryFn: () => addressService.get(id!),
    enabled: !!id,
    staleTime: STALE_TIME,
  })
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UserAddressInput) => addressService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserAddressUpdateInput }) =>
      addressService.update(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: addressKeys.detail(id) })
      const prev = qc.getQueryData(addressKeys.detail(id))
      qc.setQueryData(addressKeys.detail(id), (old: unknown) =>
        old && typeof old === 'object' ? { ...old, ...input } : old,
      )
      return { prev }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(addressKeys.detail(id), ctx.prev)
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: addressKeys.detail(id) })
      qc.invalidateQueries({ queryKey: addressKeys.all })
    },
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => addressService.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: addressKeys.all })
      const snapshots = qc.getQueriesData<{ results: { id: string }[] }>({ queryKey: addressKeys.lists() })
      snapshots.forEach(([key, data]) => {
        if (data?.results) {
          qc.setQueryData(key, {
            ...data,
            results: data.results.filter((a) => a.id !== id),
          })
        }
      })
      return { snapshots }
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  })
}

export function useRestoreAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => addressService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => addressService.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: addressKeys.all }),
  })
}

export function useAddressSuggestions(query: string, enabled = true) {
  return useQuery({
    queryKey: addressKeys.suggestions(query),
    queryFn: ({ signal }) => addressService.suggestions(query, signal),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 60_000,
  })
}

export function useReverseGeocode() {
  return useMutation({
    mutationFn: ({ latitude, longitude }: { latitude: number; longitude: number }) =>
      addressService.reverseGeocode(latitude, longitude),
  })
}

export function useCheckServiceability(payload: CheckServiceabilityPayload | null) {
  const key = useMemo(() => {
    if (!payload) return ''
    return JSON.stringify(payload)
  }, [payload])

  return useQuery({
    queryKey: addressKeys.serviceability(key),
    queryFn: () => serviceabilityService.check(payload!),
    enabled: !!payload?.branch_id && (!!payload.address_id || !!payload.delivery_address || (payload.latitude != null && payload.longitude != null)),
    staleTime: 30_000,
    retry: 1,
  })
}
