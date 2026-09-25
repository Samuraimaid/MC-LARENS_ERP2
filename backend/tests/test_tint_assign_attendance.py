import unittest
from backend.domains.hr.attendance_status import (
    resolve_attendance_state_from_events,
    resolve_availability_level,
)


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")


def simulate_tint_assign_attendance_gate(
    tech_name: str,
    clock_events: list,
    active_jobs: int = 0,
):
    att_state = resolve_attendance_state_from_events(clock_events)
    level, assignable = resolve_availability_level(att_state, active_jobs)
    if not assignable:
        labels = {
            "absent": "Ausente",
            "present": "Disponible",
            "lunch": "En almuerzo",
            "clocked_out": "Salió",
        }
        raise HTTPException(
            status_code=400,
            detail=f"{tech_name} no está disponible: {labels.get(att_state, 'ausente')}",
        )
    return {"assigned": True, "level": level}


class TestTintAssignAttendance(unittest.TestCase):
    def test_assign_absent_tech_raises_400(self):
        # Absent (no clock-in events today)
        with self.assertRaises(HTTPException) as ctx:
            simulate_tint_assign_attendance_gate("Test Polarizador", [])
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("no está disponible: Ausente", ctx.exception.detail)

    def test_assign_clocked_out_tech_raises_400(self):
        events = [
            {"event_type": "clock_in"},
            {"event_type": "clock_out"},
        ]
        with self.assertRaises(HTTPException) as ctx:
            simulate_tint_assign_attendance_gate("Test Polarizador", events)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("no está disponible: Salió", ctx.exception.detail)

    def test_assign_lunch_tech_raises_400(self):
        events = [
            {"event_type": "clock_in"},
            {"event_type": "lunch_out"},
        ]
        with self.assertRaises(HTTPException) as ctx:
            simulate_tint_assign_attendance_gate("Test Polarizador", events)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("no está disponible: En almuerzo", ctx.exception.detail)

    def test_assign_present_tech_succeeds(self):
        events = [{"event_type": "clock_in"}]
        res = simulate_tint_assign_attendance_gate("Test Polarizador", events, active_jobs=0)
        self.assertTrue(res["assigned"])
        self.assertIn(res["level"], {"green", "yellow"})


if __name__ == "__main__":
    unittest.main()
