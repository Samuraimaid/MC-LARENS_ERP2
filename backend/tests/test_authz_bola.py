"""
Pruebas Unitarias para S5 (Authz / BOLA Protection) y C3 (Least Privilege / Separación Lecturas vs Mutaciones).
MC-LARENS ERP2 - Suite de Verificación Automática.
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.authz_bola import (
    GLOBAL_ADMIN_ROLES,
    MONEY_MUTATION_ROLES,
    SALES_MUTATION_ROLES,
    STOCK_MUTATION_ROLES,
    can_access_resource,
    enforce_resource_ownership,
    enforce_role,
    has_role,
)


class MockUser:
    def __init__(self, user_id: str, role: str, branch_id: str = "branch_main"):
        self.user_id = user_id
        self.role = role
        self.branch_id = branch_id


def test_role_enforcement_money_and_stock():
    print("Running test_role_enforcement_money_and_stock...")
    cajero = MockUser("usr_caja", "cajero", "branch_main")
    vendedor = MockUser("usr_vend", "ventas", "branch_main")
    bodeguero = MockUser("usr_bodega", "bodegas", "branch_main")
    gerente = MockUser("usr_gerente", "gerencia", "branch_main")

    # 1. Mutaciones de dinero: cajero y gerente permitidos, vendedor denegado
    assert has_role(cajero, MONEY_MUTATION_ROLES) is True
    assert has_role(gerente, MONEY_MUTATION_ROLES) is True
    assert has_role(vendedor, MONEY_MUTATION_ROLES) is False

    # enforce_role no debe lanzar error para cajero
    enforce_role(cajero, MONEY_MUTATION_ROLES, "cobro de factura")

    # enforce_role debe lanzar 403 para vendedor en operación de dinero
    try:
        enforce_role(vendedor, MONEY_MUTATION_ROLES, "anulación de factura")
        assert False, "Debería haber levantado 403 para vendedor"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403

    # 2. Mutaciones de stock: bodeguero permitido, vendedor denegado
    assert has_role(bodeguero, STOCK_MUTATION_ROLES) is True
    assert has_role(vendedor, STOCK_MUTATION_ROLES) is False

    enforce_role(bodeguero, STOCK_MUTATION_ROLES, "actualización de inventario")
    try:
        enforce_role(vendedor, STOCK_MUTATION_ROLES, "modificación de producto")
        assert False, "Debería haber levantado 403 para vendedor en stock"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403

    # 3. Creación de ventas
    assert has_role(vendedor, SALES_MUTATION_ROLES) is True
    assert has_role(cajero, SALES_MUTATION_ROLES) is True
    technician = MockUser("usr_tech", "electrico", "branch_main")
    assert has_role(technician, SALES_MUTATION_ROLES) is False

    print("[OK] Least privilege: Money and stock mutation roles strictly validated.")


def test_bola_protection_resource_access():
    print("Running test_bola_protection_resource_access...")
    seller_north = MockUser("usr_vendedor_north", "ventas", "branch_north")
    seller_south = MockUser("usr_vendedor_south", "ventas", "branch_south")
    admin_user = MockUser("usr_admin", "gerencia", "branch_main")

    sale_north = {
        "sale_id": "sale_101",
        "salesperson_id": "usr_vendedor_north",
        "branch_id": "branch_north",
        "total": 500.0,
    }

    sale_south = {
        "sale_id": "sale_202",
        "salesperson_id": "usr_vendedor_south",
        "branch_id": "branch_south",
        "total": 850.0,
    }

    # 1. Propietario en su propia sucursal accede OK
    assert can_access_resource(seller_north, sale_north) is True
    enforce_resource_ownership(seller_north, sale_north, resource_name="venta")

    # 2. BOLA: Vendedor del norte intentando acceder a venta del sur -> BLOQUEADO (False y 403)
    assert can_access_resource(seller_north, sale_south) is False
    try:
        enforce_resource_ownership(seller_north, sale_south, resource_name="venta")
        assert False, "Debería haber levantado 403 por BOLA"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403
        detail = getattr(exc, "detail", {})
        assert detail.get("error") == "FORBIDDEN_OBJECT_ACCESS"

    # 3. Vendedor del sur intentando acceder a venta del norte -> BLOQUEADO
    assert can_access_resource(seller_south, sale_north) is False
    try:
        enforce_resource_ownership(seller_south, sale_north, resource_name="venta")
        assert False, "Debería haber levantado 403 por BOLA"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 403

    # 4. Administrador / Gerencia global accede a cualquier recurso cross-sucursal
    assert can_access_resource(admin_user, sale_north) is True
    assert can_access_resource(admin_user, sale_south) is True
    enforce_resource_ownership(admin_user, sale_north, resource_name="venta")
    enforce_resource_ownership(admin_user, sale_south, resource_name="venta")

    # 5. Órdenes de trabajo con campo secundario technician_id
    tech_1 = MockUser("tech_001", "electrico", "branch_north")
    tech_2 = MockUser("tech_002", "polarizador", "branch_south")

    work_order_north = {
        "work_order_id": "wo_999",
        "technician_id": "tech_001",
        "branch_id": "branch_north",
    }

    assert can_access_resource(
        tech_1, work_order_north, owner_field="technician_id", branch_field="branch_id"
    ) is True

    assert can_access_resource(
        tech_2, work_order_north, owner_field="technician_id", branch_field="branch_id"
    ) is False

    print("[OK] BOLA protection strictly limits resource access to owner/branch while granting global admin access.")


if __name__ == "__main__":
    test_role_enforcement_money_and_stock()
    test_bola_protection_resource_access()
    print("\nALL S5 & C3 AUTHZ AND BOLA TESTS PASSED SUCCESSFULLY! (100% OK)")
