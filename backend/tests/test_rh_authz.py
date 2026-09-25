import unittest
from backend.core.authz_bola import (
    GLOBAL_ADMIN_ROLES,
    MONEY_MUTATION_ROLES,
    STOCK_MUTATION_ROLES,
    has_role,
    enforce_role,
)


class MockUser:
    def __init__(self, user_id: str, role: str, branch_id: str = "branch_main"):
        self.user_id = user_id
        self.role = role
        self.branch_id = branch_id


def resolve_effective_role_check(role: str) -> str:
    # Simulates server.py's updated ROLE_EQUIVALENCE
    equivalence = {
        "jefe_vendedores": "supervisor",
        "jefe_tienda": "supervisor",
    }
    return equivalence.get(role, role)


def check_require_roles(user_role: str, allowed_roles: list) -> bool:
    user_eff = resolve_effective_role_check(user_role)
    allowed_eff = [resolve_effective_role_check(r) for r in allowed_roles]
    return user_eff in allowed_eff


class TestRHAuthz(unittest.TestCase):
    def test_rh_effective_role_is_not_gerencia(self):
        eff = resolve_effective_role_check("recursos_humanos")
        self.assertEqual(eff, "recursos_humanos")
        self.assertNotEqual(eff, "gerencia")

    def test_products_endpoint_authorization(self):
        # Product creation roles in server.py line 7215:
        product_roles = ["gerencia", "supervisor", "bodegas", "jefe_tienda"]

        # Gerencia can create products
        self.assertTrue(check_require_roles("gerencia", product_roles))
        # Bodegas can create products
        self.assertTrue(check_require_roles("bodegas", product_roles))
        # Recursos Humanos CANNOT create products (must be 403)
        self.assertFalse(check_require_roles("recursos_humanos", product_roles))

    def test_stock_and_money_mutations_reject_rh(self):
        rh_user = MockUser("rh_1", "recursos_humanos")
        gerencia_user = MockUser("ger_1", "gerencia")

        # RRHH cannot mutate stock
        self.assertFalse(has_role(rh_user, STOCK_MUTATION_ROLES))
        self.assertTrue(has_role(gerencia_user, STOCK_MUTATION_ROLES))

        # RRHH cannot mutate money
        self.assertFalse(has_role(rh_user, MONEY_MUTATION_ROLES))
        self.assertTrue(has_role(gerencia_user, MONEY_MUTATION_ROLES))

        # Enforce role raises 403 for RRHH on stock mutation
        with self.assertRaises(Exception) as ctx:
            enforce_role(rh_user, STOCK_MUTATION_ROLES, "crear producto")
        self.assertEqual(getattr(ctx.exception, "status_code", None), 403)


if __name__ == "__main__":
    unittest.main()
