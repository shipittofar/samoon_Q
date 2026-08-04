"""
Phase 3 reference view for GET /auth/me/.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import AuthMeService


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # session_state should come from server-side switch-tenant/branch store
        session_state = {
            "active_tenant_id": getattr(request, "active_tenant_id", None),
            "active_branch_id": getattr(request, "active_branch_id", None),
        }
        service = AuthMeService(
            membership_model=request.user.memberships.model,
            branch_model=None,  # branches accessed via tenant prefetch
        )
        from accounts.serializers import UserSerializer  # replace with real import

        payload = service.build_payload(request.user, UserSerializer, session_state)
        return Response(payload)
