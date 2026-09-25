import asyncio
import unittest
from backend.domains.operations.work_order_maintenance import (
    generate_work_order_id,
    ensure_valid_work_order_id,
    cancel_null_id_work_orders,
)


class MockResult:
    def __init__(self, modified_count):
        self.modified_count = modified_count


class MockWorkOrdersCollection:
    def __init__(self, docs):
        self.docs = docs
        self.last_update_query = None
        self.last_update_op = None

    async def update_many(self, filter_query, update_op):
        self.last_update_query = filter_query
        self.last_update_op = update_op
        modified = 0
        for doc in self.docs:
            wo_id = doc.get("work_order_id")
            if (wo_id is None or wo_id == "" or "work_order_id" not in doc) and doc.get("status") != "cancelled":
                doc["status"] = "cancelled"
                doc["notes"] = "Cancelada automáticamente"
                modified += 1
        return MockResult(modified)


class MockDb:
    def __init__(self, docs):
        self.work_orders = MockWorkOrdersCollection(docs)


class TestWorkOrderIdNeverNull(unittest.TestCase):
    def test_generate_work_order_id_format_and_uniqueness(self):
        ids = {generate_work_order_id() for _ in range(100)}
        self.assertEqual(len(ids), 100)
        for wo_id in ids:
            self.assertTrue(wo_id.startswith("wo_"))
            self.assertGreaterEqual(len(wo_id), 10)

    def test_ensure_valid_work_order_id_generates_when_missing(self):
        doc1 = {"customer_id": "cust_1"}
        wo_id1 = ensure_valid_work_order_id(doc1)
        self.assertTrue(wo_id1.startswith("wo_"))
        self.assertEqual(doc1["work_order_id"], wo_id1)

        doc2 = {"work_order_id": None}
        wo_id2 = ensure_valid_work_order_id(doc2)
        self.assertTrue(wo_id2.startswith("wo_"))
        self.assertEqual(doc2["work_order_id"], wo_id2)

        doc3 = {"work_order_id": ""}
        wo_id3 = ensure_valid_work_order_id(doc3)
        self.assertTrue(wo_id3.startswith("wo_"))
        self.assertEqual(doc3["work_order_id"], wo_id3)

    def test_ensure_valid_work_order_id_preserves_existing(self):
        doc = {"work_order_id": "wo_existing_1234"}
        wo_id = ensure_valid_work_order_id(doc)
        self.assertEqual(wo_id, "wo_existing_1234")
        self.assertEqual(doc["work_order_id"], "wo_existing_1234")

    def test_cancel_null_id_work_orders(self):
        mock_docs = [
            {"_id": "1", "work_order_id": "wo_valid_1", "status": "pending"},
            {"_id": "2", "work_order_id": None, "status": "pending"},
            {"_id": "3", "status": "in_progress"}, # missing work_order_id
            {"_id": "4", "work_order_id": "", "status": "pending"},
            {"_id": "5", "work_order_id": None, "status": "cancelled"}, # already cancelled
        ]
        mock_db = MockDb(mock_docs)
        cancelled_count = asyncio.run(cancel_null_id_work_orders(mock_db))

        self.assertEqual(cancelled_count, 3)
        # Check that valid doc is untouched
        self.assertEqual(mock_docs[0]["status"], "pending")
        # Check that orphan docs were cancelled
        self.assertEqual(mock_docs[1]["status"], "cancelled")
        self.assertEqual(mock_docs[2]["status"], "cancelled")
        self.assertEqual(mock_docs[3]["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()
