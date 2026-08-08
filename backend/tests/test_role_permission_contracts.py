"""Contract tests: shop-floor roles must retain write on their core functions."""


def _load_matrix_helpers():
    # Import from server module is heavy; exercise build via re-import of permission builders.
    from backend.server import (
        ROLE_WRITE_ALLOWED_FUNCTIONS,
        build_default_role_permissions,
        get_permission_value,
    )

    return ROLE_WRITE_ALLOWED_FUNCTIONS, build_default_role_permissions, get_permission_value


def test_coordinator_instalaciones_can_edit_work_orders_and_qc():
    _, build, get_perm = _load_matrix_helpers()
    matrix = build("coordinador_instalaciones")
    assert get_perm(matrix, "work_orders", "edit") is True
    assert get_perm(matrix, "work_orders", "view") is True
    assert get_perm(matrix, "quality_control", "create") is True
    assert get_perm(matrix, "quality_control", "edit") is True


def test_coordinator_polarizados_can_edit_work_orders_and_tint():
    _, build, get_perm = _load_matrix_helpers()
    matrix = build("coordinador_polarizados")
    assert get_perm(matrix, "work_orders", "edit") is True
    assert get_perm(matrix, "tint_orders", "edit") is True
    assert get_perm(matrix, "quality_control", "edit") is True


def test_polarizador_can_edit_work_orders_and_tint():
    _, build, get_perm = _load_matrix_helpers()
    matrix = build("polarizador")
    assert get_perm(matrix, "work_orders", "edit") is True
    assert get_perm(matrix, "tint_orders", "edit") is True


def test_electrico_and_instalador_can_edit_work_orders():
    _, build, get_perm = _load_matrix_helpers()
    for role in ("electrico", "instalaciones"):
        matrix = build(role)
        assert get_perm(matrix, "work_orders", "edit") is True, role


def test_ventas_cannot_edit_work_orders_or_dispatch():
    _, build, get_perm = _load_matrix_helpers()
    matrix = build("ventas")
    assert get_perm(matrix, "work_orders", "edit") is False
    assert get_perm(matrix, "dispatch", "edit") is False
    assert get_perm(matrix, "sales", "create") is True


def test_write_allowlist_contains_ops_roles():
    allow, _, _ = _load_matrix_helpers()
    assert "work_orders" in allow["coordinador_instalaciones"]
    assert "work_orders" in allow["coordinador_polarizados"]
    assert "work_orders" in allow["polarizador"]
    assert "tint_orders" in allow["polarizador"]
