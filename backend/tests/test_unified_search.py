import asyncio
import re
from unittest.mock import AsyncMock, MagicMock

from backend.domains.search.unified_search import (
    normalize_plate_token,
    plate_flexible_regex,
    unified_search,
)


def test_normalize_plate_token_strips_spaces_and_dashes():
    assert normalize_plate_token("M 123 261") == "M123261"
    assert normalize_plate_token("m-123") == "M123"


def test_plate_flexible_regex_matches_spaced_plates():
    pattern = plate_flexible_regex("M123")
    assert pattern
    assert re.search(pattern, "M 123 261", re.IGNORECASE)
    assert re.search(pattern, "M123261", re.IGNORECASE)
    assert re.search(pattern, "M 123", re.IGNORECASE)


def test_unified_search_empty_query_returns_empty():
    db = MagicMock()
    db.users.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    db.customers.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    db.vehicles.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    db.sales.find = MagicMock(return_value=MagicMock(
        sort=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    ))
    db.quotations.find = MagicMock(return_value=MagicMock(
        sort=MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    ))

    result = asyncio.run(unified_search(
        db,
        user={"user_id": "u1", "role": "gerencia", "branch_id": "branch_main", "name": "Admin"},
        sales_visibility_query={},
        q="",
        limit=10,
    ))
    assert result["total"] == 0
    assert result["results"] == []