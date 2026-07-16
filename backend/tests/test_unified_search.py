import asyncio
from unittest.mock import AsyncMock, MagicMock

from backend.domains.search.unified_search import unified_search


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