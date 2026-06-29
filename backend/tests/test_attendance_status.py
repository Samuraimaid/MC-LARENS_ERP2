from backend.domains.hr.attendance_status import (
    resolve_attendance_state_from_events,
    resolve_availability_level,
)


def test_resolve_attendance_absent_without_events():
    assert resolve_attendance_state_from_events([]) == "absent"


def test_resolve_attendance_lunch_after_lunch_out():
    events = [{"event_type": "clock_in"}, {"event_type": "lunch_out"}]
    assert resolve_attendance_state_from_events(events) == "lunch"


def test_resolve_attendance_present_after_lunch_in():
    events = [
        {"event_type": "clock_in"},
        {"event_type": "lunch_out"},
        {"event_type": "lunch_in"},
    ]
    assert resolve_attendance_state_from_events(events) == "present"


def test_resolve_availability_red_when_absent():
    level, assignable = resolve_availability_level("absent", 0)
    assert level == "red"
    assert assignable is False


def test_resolve_availability_green_when_present_and_idle():
    level, assignable = resolve_availability_level("present", 0)
    assert level == "green"
    assert assignable is True


def test_resolve_availability_yellow_when_working():
    level, assignable = resolve_availability_level("present", 1)
    assert level == "yellow"
    assert assignable is True