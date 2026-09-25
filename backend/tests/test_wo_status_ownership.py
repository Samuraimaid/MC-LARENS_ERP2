import unittest
from typing import Any, Dict, Optional


WORK_ORDER_FIELD_TECHNICIAN_ROLES = {
    "instalaciones",
    "instalador",
    "electrico",
    "polarizador",
}


class MockUser:
    def __init__(self, user_id: str, role: str, name: str = "Test User"):
        self.user_id = user_id
        self.role = role
        self.name = name


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


def check_wo_ownership(
    user: MockUser,
    wo: Dict[str, Any],
    update_tech_id: Optional[str] = None,
) -> Dict[str, Any]:
    raw_role = str(user.role or "").strip().lower()
    updates: Dict[str, Any] = {}

    if raw_role in WORK_ORDER_FIELD_TECHNICIAN_ROLES:
        assigned_tech = wo.get("technician_id")
        # 1. Block cross-technician mutation
        if assigned_tech and str(assigned_tech).strip() not in (user.user_id, "unassigned"):
            raise HTTPException(
                status_code=403,
                detail="No está autorizado para modificar una orden asignada a otro técnico",
            )
        # 2. Block department cross-contamination
        wo_dept = str(wo.get("department") or "instalaciones").strip().lower()
        if raw_role == "electrico" and wo_dept != "electrico":
            raise HTTPException(
                status_code=403,
                detail="No autorizado para modificar órdenes de otro departamento",
            )
        elif raw_role == "polarizador" and wo_dept not in ("polarizados", "polarizado"):
            raise HTTPException(
                status_code=403,
                detail="No autorizado para modificar órdenes de otro departamento",
            )
        elif raw_role in ("instalaciones", "instalador") and wo_dept not in ("instalaciones", ""):
            raise HTTPException(
                status_code=403,
                detail="No autorizado para modificar órdenes de otro departamento",
            )
        # 3. Block reassigning to others
        if update_tech_id and str(update_tech_id).strip() != user.user_id:
            raise HTTPException(
                status_code=403,
                detail="No está autorizado para reasignar técnicos",
            )

        # Self-claim unassigned order
        if not assigned_tech or str(assigned_tech).strip() == "unassigned":
            updates["technician_id"] = user.user_id
            updates["technician_name"] = user.name
            updates["assignment_status"] = "assigned"

    return updates


class TestWoStatusOwnership(unittest.TestCase):
    def test_tech_cannot_mutate_another_techs_wo(self):
        tech_a = MockUser("tech_a", "instalaciones", "Tech A")
        wo_of_tech_b = {
            "work_order_id": "wo_123",
            "department": "instalaciones",
            "technician_id": "tech_b",
            "technician_name": "Tech B",
            "status": "in_progress",
        }

        with self.assertRaises(HTTPException) as ctx:
            check_wo_ownership(tech_a, wo_of_tech_b)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("asignada a otro técnico", ctx.exception.detail)

    def test_tech_can_mutate_own_wo(self):
        tech_a = MockUser("tech_a", "instalaciones", "Tech A")
        wo_of_tech_a = {
            "work_order_id": "wo_123",
            "department": "instalaciones",
            "technician_id": "tech_a",
            "technician_name": "Tech A",
            "status": "in_progress",
        }

        updates = check_wo_ownership(tech_a, wo_of_tech_a)
        self.assertNotIn("technician_id", updates)

    def test_tech_can_self_claim_unassigned_wo(self):
        tech_a = MockUser("tech_a", "instalaciones", "Tech A")
        unassigned_wo = {
            "work_order_id": "wo_124",
            "department": "instalaciones",
            "technician_id": None,
            "status": "pending",
        }

        updates = check_wo_ownership(tech_a, unassigned_wo)
        self.assertEqual(updates.get("technician_id"), "tech_a")
        self.assertEqual(updates.get("technician_name"), "Tech A")
        self.assertEqual(updates.get("assignment_status"), "assigned")

    def test_tech_cross_department_forbidden(self):
        tech_elec = MockUser("tech_e", "electrico", "Tech Electrico")
        wo_inst = {
            "work_order_id": "wo_125",
            "department": "instalaciones",
            "technician_id": None,
            "status": "pending",
        }

        with self.assertRaises(HTTPException) as ctx:
            check_wo_ownership(tech_elec, wo_inst)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("otro departamento", ctx.exception.detail)

    def test_coordinator_and_gerencia_exempt(self):
        coord = MockUser("coord_1", "coordinador_instalaciones", "Coord Inst")
        gerente = MockUser("ger_1", "gerencia", "Xinon")
        wo = {
            "work_order_id": "wo_126",
            "department": "instalaciones",
            "technician_id": "tech_b",
            "status": "in_progress",
        }

        # Both should execute without 403
        updates_coord = check_wo_ownership(coord, wo)
        updates_gerente = check_wo_ownership(gerente, wo)
        self.assertEqual(updates_coord, {})
        self.assertEqual(updates_gerente, {})


if __name__ == "__main__":
    unittest.main()
