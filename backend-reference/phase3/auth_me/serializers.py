"""
Phase 3 reference serializers for GET /auth/me/.
Apply camelCase via DRF renderer or explicit field names matching frontend contract.
"""
from rest_framework import serializers


class MembershipBranchSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()
    status = serializers.ChoiceField(choices=["active", "inactive", "maintenance"])
    isDefault = serializers.BooleanField(source="is_default", required=False)


class BranchAccessSerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=["all", "selected"])
    branchIds = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        source="branch_ids",
    )


class TenantMembershipSerializer(serializers.Serializer):
    tenantId = serializers.CharField(source="tenant_id")
    tenantName = serializers.CharField(source="tenant_name")
    tenantSlug = serializers.CharField(source="tenant_slug")
    tenantLogo = serializers.CharField(source="tenant_logo", allow_null=True, required=False)
    roles = serializers.ListField(child=serializers.CharField())
    branchAccess = BranchAccessSerializer(source="branch_access")
    branches = MembershipBranchSerializer(many=True)
    status = serializers.CharField(required=False)


class ActiveMembershipSerializer(serializers.Serializer):
    tenantId = serializers.CharField()
    branchId = serializers.CharField(allow_null=True, required=False)
    tenantName = serializers.CharField(required=False)
    branchName = serializers.CharField(allow_null=True, required=False)


class MeResponseSerializer(serializers.Serializer):
    user = serializers.DictField()
    memberships = TenantMembershipSerializer(many=True)
    activeMembership = ActiveMembershipSerializer(required=False)
