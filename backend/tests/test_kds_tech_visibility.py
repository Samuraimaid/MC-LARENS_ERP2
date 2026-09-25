import asyncio
import unittest
from backend.core.work_order_visibility import (
    build_work_order_visibility_query,
    merge_queries,
)


class MockUser:
    def __init__(self, user_id: str, role: str, branch_id: str = "branch_main", email: str = ""):
        self.user_id = user_id
        self.role = role
        self.branch_id = branch_id
        self.email = email


class TestKdsTechVisibility(unittest.TestCase):
    def test_tech_instalaciones_visibility(self):
        user = MockUser(
            user_id="tech_inst_1",
            email="tech1@local",
            role="instalaciones",
            branch_id="branch_main",
        )
        query = asyncio.run(build_work_order_visibility_query(user))

        self.assertEqual(query.get("branch_id"), "branch_main")
        self.assertIn("$and", query)
        and_clauses = query["$and"]
        self.assertEqual(len(and_clauses), 2)

        dept_clause, tech_clause = and_clauses[0], and_clauses[1]
        self.assertIn("$or", dept_clause)
        self.assertIn({"department": "instalaciones"}, dept_clause["$or"])

        self.assertIn("$or", tech_clause)
        or_techs = tech_clause["$or"]
        self.assertIn({"technician_id": "tech_inst_1"}, or_techs)
        self.assertIn({"technician_id": None}, or_techs)
        self.assertIn({"technician_id": ""}, or_techs)
        self.assertIn({"technician_id": "unassigned"}, or_techs)
        self.assertIn({"technician_id": {"$exists": False}}, or_techs)

    def test_tech_electrico_visibility(self):
        user = MockUser(
            user_id="tech_elec_1",
            email="elec1@local",
            role="electrico",
            branch_id="branch_main",
        )
        query = asyncio.run(build_work_order_visibility_query(user))

        self.assertEqual(query.get("department"), "electrico")
        self.assertIn("$or", query)
        or_techs = query["$or"]
        self.assertIn({"technician_id": "tech_elec_1"}, or_techs)
        self.assertIn({"technician_id": None}, or_techs)

    def test_tech_polarizador_visibility(self):
        user = MockUser(
            user_id="tech_pol_1",
            email="pol1@local",
            role="polarizador",
            branch_id="branch_main",
        )
        query = asyncio.run(build_work_order_visibility_query(user))

        self.assertEqual(query.get("department"), {"$in": ["polarizados", "polarizado"]})
        self.assertIn("$or", query)
        or_techs = query["$or"]
        self.assertIn({"technician_id": "tech_pol_1"}, or_techs)
        self.assertIn({"technician_id": None}, or_techs)

    def test_coordinator_and_gerencia_no_regression(self):
        coord_inst = MockUser(
            user_id="coord_1",
            email="coord1@local",
            role="coordinador_instalaciones",
            branch_id="branch_main",
        )
        query_coord = asyncio.run(build_work_order_visibility_query(coord_inst))
        self.assertNotIn("technician_id", query_coord)
        self.assertNotIn("technician_id", str(query_coord))

        gerencia = MockUser(
            user_id="gerencia_1",
            email="xinon@local",
            role="gerencia",
            branch_id="branch_main",
        )
        query_gerencia = asyncio.run(build_work_order_visibility_query(gerencia))
        self.assertEqual(query_gerencia, {})

        supervisor = MockUser(
            user_id="sup_1",
            email="sup@local",
            role="supervisor",
            branch_id="branch_main",
        )
        query_sup = asyncio.run(build_work_order_visibility_query(supervisor))
        self.assertEqual(query_sup, {"branch_id": "branch_main"})

    def test_merge_queries_combining(self):
        base = {"status": {"$in": ["pending", "in_progress"]}}
        user = MockUser("tech_elec_1", "electrico", "branch_main")
        vis = asyncio.run(build_work_order_visibility_query(user))
        merged = merge_queries(base, vis)
        self.assertIn("$and", merged)
        self.assertEqual(merged["$and"][0], base)
        self.assertEqual(merged["$and"][1], vis)


if __name__ == "__main__":
    unittest.main()
