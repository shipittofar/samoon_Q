"""
Phase 3 — AuthMeService: membership + branch hydration for GET /auth/me/.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


ACTIVE_BRANCH_STATUSES = {"active", "maintenance"}


@dataclass
class BranchAccessDTO:
    scope: str
    branch_ids: list[str] | None = None

    def to_wire(self) -> dict:
        if self.scope == "all":
            return {"scope": "all"}
        return {"scope": "selected", "branchIds": self.branch_ids or []}


@dataclass
class BranchDTO:
    id: str
    name: str
    slug: str
    status: str
    is_default: bool = False

    def to_wire(self) -> dict:
        payload = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "status": self.status,
        }
        if self.is_default:
            payload["isDefault"] = True
        return payload


@dataclass
class MembershipDTO:
    tenant_id: str
    tenant_name: str
    tenant_slug: str
    tenant_logo: str | None
    roles: list[str]
    branch_access: BranchAccessDTO
    branches: list[BranchDTO]
    status: str = "active"

    def to_wire(self) -> dict:
        return {
            "tenantId": self.tenant_id,
            "tenantName": self.tenant_name,
            "tenantSlug": self.tenant_slug,
            "tenantLogo": self.tenant_logo,
            "roles": self.roles,
            "branchAccess": self.branch_access.to_wire(),
            "branches": [b.to_wire() for b in self.branches],
            "status": self.status,
        }


class AuthMeService:
    """
    Query plan (constant 5 queries):
      1. user (from request.user, already loaded by auth)
      2. memberships + select_related('tenant')
      3. prefetch roles
      4. prefetch assigned_branches
      5. prefetch tenant branches (filtered per membership in Python)
    """

    def __init__(self, membership_model, branch_model):
        self.membership_model = membership_model
        self.branch_model = branch_model

    def accessible_branches(self, membership, tenant_branches: Iterable) -> list[BranchDTO]:
        visible = [
            b
            for b in tenant_branches
            if getattr(b, "tenant_id", None) == membership.tenant_id
            and getattr(b, "status", "active") in ACTIVE_BRANCH_STATUSES
        ]
        if membership.branch_scope == "all":
            allowed = visible
        else:
            assigned_ids = {str(b.id) for b in membership.assigned_branches.all()}
            allowed = [b for b in visible if str(b.id) in assigned_ids]
        return [
            BranchDTO(
                id=str(b.id),
                name=b.name,
                slug=b.slug,
                status=b.status,
                is_default=bool(getattr(b, "is_default", False)),
            )
            for b in allowed
        ]

    def build_memberships(self, user) -> list[MembershipDTO]:
        qs = (
            self.membership_model.objects.filter(user=user, status="active")
            .select_related("tenant")
            .prefetch_related("roles", "assigned_branches", "tenant__branches")
        )
        memberships: list[MembershipDTO] = []
        for row in qs:
            tenant = row.tenant
            roles = [r.code for r in row.roles.all()]
            branch_access = (
                BranchAccessDTO(scope="all")
                if row.branch_scope == "all"
                else BranchAccessDTO(
                    scope="selected",
                    branch_ids=[str(b.id) for b in row.assigned_branches.all()],
                )
            )
            branches = self.accessible_branches(row, tenant.branches.all())
            memberships.append(
                MembershipDTO(
                    tenant_id=str(tenant.id),
                    tenant_name=tenant.name,
                    tenant_slug=tenant.slug,
                    tenant_logo=getattr(tenant, "image", None)
                    or (tenant.settings or {}).get("logo"),
                    roles=roles,
                    branch_access=branch_access,
                    branches=branches,
                    status=row.status,
                )
            )
        return memberships

    def resolve_active_membership(
        self,
        memberships: list[MembershipDTO],
        active_tenant_id: str | None,
        active_branch_id: str | None,
    ) -> dict | None:
        if not active_tenant_id:
            return None
        membership = next((m for m in memberships if m.tenant_id == active_tenant_id), None)
        if not membership:
            return None
        branch_name = None
        if active_branch_id:
            branch = next((b for b in membership.branches if b.id == active_branch_id), None)
            if not branch:
                active_branch_id = None
            else:
                branch_name = branch.name
        return {
            "tenantId": membership.tenant_id,
            "tenantName": membership.tenant_name,
            "branchId": active_branch_id,
            "branchName": branch_name,
        }

    def build_payload(self, user, user_serializer, session_state) -> dict:
        memberships = self.build_memberships(user)
        active = self.resolve_active_membership(
            memberships,
            session_state.get("active_tenant_id"),
            session_state.get("active_branch_id"),
        )
        return {
            "user": user_serializer(user).data,
            "memberships": [m.to_wire() for m in memberships],
            **({"activeMembership": active} if active else {}),
        }
