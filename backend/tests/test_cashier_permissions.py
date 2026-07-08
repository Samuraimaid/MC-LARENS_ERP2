"""Cashier API permissions: cajero must open caja and read public billing settings."""

from __future__ import annotations

from backend.server import (
    build_default_role_permissions,
    get_permission_value,
    match_permission_function_for_path,
)


class TestCashierPermissions:
    def test_caja_routes_map_to_cashier_function(self):
        assert match_permission_function_for_path("/api/caja/apertura") == "cashier"
        assert match_permission_function_for_path("/api/caja/sesion-activa") == "cashier"

    def test_cajero_role_can_create_cashier_actions(self):
        matrix = build_default_role_permissions("cajero")
        assert get_permission_value(matrix, "cashier", "view") is True
        assert get_permission_value(matrix, "cashier", "create") is True