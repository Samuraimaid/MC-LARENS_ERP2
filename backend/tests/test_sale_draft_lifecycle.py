"""Sale draft lifecycle helpers."""

from backend.server import _consume_sale_draft_after_submission


def test_consume_sale_draft_helper_is_importable():
    assert callable(_consume_sale_draft_after_submission)