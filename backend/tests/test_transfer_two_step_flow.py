"""Transfer request status progression for two-step logistics."""

from __future__ import annotations

VALID_TRANSFER_STATUSES = {
    "pending",
    "approved",
    "shipped",
    "received",
    "rejected",
}

TWO_STEP_TRANSITIONS = {
    "pending": {"approved", "rejected"},
    "approved": {"shipped"},
    "shipped": {"received"},
}


def test_valid_statuses_include_two_step_flow():
    assert "approved" in VALID_TRANSFER_STATUSES
    assert "shipped" in VALID_TRANSFER_STATUSES
    assert "received" in VALID_TRANSFER_STATUSES


def test_two_step_transition_chain():
    assert "approved" in TWO_STEP_TRANSITIONS["pending"]
    assert "shipped" in TWO_STEP_TRANSITIONS["approved"]
    assert "received" in TWO_STEP_TRANSITIONS["shipped"]