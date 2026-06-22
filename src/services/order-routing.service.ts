import type { OrderType } from '@/types'
import type { Branch as BranchEntity } from '@/types/branch'
import type { BranchAccessContext, BranchAssignmentRule } from '@/types/branch-routing'
import { branchAccessService } from '@/services/branch-access.service'

/** Context provided when routing an order to a branch. */
export interface OrderRoutingContext {
  orderType: OrderType
  tableNumber?: number
  customerChosenBranchId?: string
  latitude?: number
  longitude?: number
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Declarative routing rules per order type. */
export const ORDER_ROUTING_RULES: BranchAssignmentRule[] = [
  { orderType: 'dine_in',  branchSelectionStrategy: 'table',           requiresActiveBranch: true },
  { orderType: 'delivery', branchSelectionStrategy: 'customer_choice', requiresActiveBranch: true },
  { orderType: 'pickup',   branchSelectionStrategy: 'nearest',         requiresActiveBranch: true },
]

export const orderRoutingService = {
  /** Resolves which branch should handle an order given the order type and context.
   *  Returns null when no active branch is available. */
  async resolveBranchForOrder(
    routingCtx: OrderRoutingContext,
    activeBranches: BranchEntity[],
  ): Promise<string | null> {
    await delay(10)
    const active = activeBranches.filter((b) => b.status === 'active')
    if (active.length === 0) return null

    switch (routingCtx.orderType) {
      case 'dine_in': {
        // Real path: look up table.branchId; mock uses first active branch
        return active[0].id
      }
      case 'delivery': {
        if (routingCtx.customerChosenBranchId) {
          const chosen = active.find((b) => b.id === routingCtx.customerChosenBranchId)
          return chosen?.id ?? active[0].id
        }
        return active[0].id
      }
      case 'pickup': {
        // Nearest physical branch; mock: first active physical else first active
        const nearest = active.find((b) => b.type === 'physical') ?? active[0]
        return nearest.id
      }
      default:
        return active[0].id
    }
  },

  /** Returns true when the actor is authorised to place/view orders for the given branch. */
  validateBranchOrderAccess(
    branchId: string,
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): boolean {
    return branchAccessService.canAccessBranch(branchId, context, allBranches)
  },

  /** Filters an order list to records whose branch_id the actor can access. */
  getAccessibleOrders<T extends { branch_id: string }>(
    orders: T[],
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): T[] {
    return branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      context,
      allBranches,
    ).records
  },

  /** Filters a reservation list to records whose branch_id the actor can access. */
  getAccessibleReservations<T extends { branch_id: string }>(
    reservations: T[],
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): T[] {
    return branchAccessService.filterByAccessibleBranches(
      reservations,
      (r) => r.branch_id,
      context,
      allBranches,
    ).records
  },

  /** Returns true when the actor is authorised to access reservations for the given branch. */
  validateReservationBranch(
    branchId: string,
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): boolean {
    return branchAccessService.canAccessBranch(branchId, context, allBranches)
  },
}
