import unittest


ROLE_EQUIVALENCE = {}


def resolve_effective_role(role: str) -> str:
    if not role:
        return ""
    return ROLE_EQUIVALENCE.get(role, role)


def check_require_roles(user_role: str, allowed_roles: list) -> bool:
    user_eff = resolve_effective_role(user_role)
    allowed_eff = [resolve_effective_role(r) for r in allowed_roles]
    return user_eff in allowed_eff


class TestJefeAuthz(unittest.TestCase):
    def test_jefe_roles_not_globally_elevated_to_supervisor(self):
        self.assertEqual(resolve_effective_role("jefe_tienda"), "jefe_tienda")
        self.assertNotEqual(resolve_effective_role("jefe_tienda"), "supervisor")

        self.assertEqual(resolve_effective_role("jefe_vendedores"), "jefe_vendedores")
        self.assertNotEqual(resolve_effective_role("jefe_vendedores"), "supervisor")

    def test_supervisor_only_endpoints_reject_jefe(self):
        # Endpoints intended only for supervisor / gerencia (e.g. override, managerial approvals)
        supervisor_only = ["gerencia", "supervisor"]

        self.assertTrue(check_require_roles("gerencia", supervisor_only))
        self.assertTrue(check_require_roles("supervisor", supervisor_only))
        self.assertFalse(check_require_roles("jefe_tienda", supervisor_only))
        self.assertFalse(check_require_roles("jefe_vendedores", supervisor_only))

    def test_explicit_grants_work_for_jefe(self):
        # Product catalog mutation where jefe_tienda is explicitly authorized
        product_roles = ["gerencia", "supervisor", "bodegas", "jefe_tienda"]
        self.assertTrue(check_require_roles("jefe_tienda", product_roles))
        self.assertFalse(check_require_roles("jefe_vendedores", product_roles))

        # Sales operations where both are explicitly authorized
        sales_roles = ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"]
        self.assertTrue(check_require_roles("jefe_tienda", sales_roles))
        self.assertTrue(check_require_roles("jefe_vendedores", sales_roles))


if __name__ == "__main__":
    unittest.main()
