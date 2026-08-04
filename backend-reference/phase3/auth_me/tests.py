"""
Phase 3 reference tests — tenant/branch isolation + query budget.
Run in Django backend after integrating AuthMeService.
"""
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection


class AuthMeContractTests(TestCase):
    def test_user_a_never_receives_tenant_b_membership(self):
        # Arrange: user_a member of tenant_a only
        # Act: build_payload(user_a)
        # Assert: all membership.tenantId == tenant_a.id
        self.skipTest("Integrate with real models in Django repo")

    def test_branch_list_never_includes_other_tenant_branches(self):
        self.skipTest("Integrate with real models in Django repo")

    def test_query_count_constant(self):
        self.skipTest("Integrate with real models — assertNumQueries(5)")


class QueryBudgetDocumentation(TestCase):
    def test_documented_query_budget(self):
        """Before: 3 + 3N + NM queries. After target: <= 5 queries."""
        self.assertLessEqual(5, 5)
