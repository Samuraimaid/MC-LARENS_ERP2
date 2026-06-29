from backend.server import _dispatch_is_pending_purgeable


def test_pending_dispatch_is_purgeable():
    assert _dispatch_is_pending_purgeable(
        {"status": "pending", "items": [{"delivered": False}]}
    )


def test_in_progress_dispatch_not_purgeable():
    assert not _dispatch_is_pending_purgeable(
        {"status": "in_progress", "started_at": "2026-01-01T10:00:00+00:00", "items": []}
    )


def test_pending_with_delivered_item_not_purgeable():
    assert not _dispatch_is_pending_purgeable(
        {"status": "pending", "items": [{"delivered": True}]}
    )