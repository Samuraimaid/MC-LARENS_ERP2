import os
from pprint import pprint

from pymongo import MongoClient


def main() -> None:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("MONGO_DB", os.environ.get("DB_NAME", "erp"))

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    summary = {"db": db_name, "mongo_url": mongo_url, "candidates": {}, "deleted": {}}

    customer_query = {
        "$or": [
            {"name": {"$regex": r"^(RBAC|RBAC2)\b", "$options": "i"}},
            {"first_name": {"$regex": r"^RBAC", "$options": "i"}},
            {"email": {"$regex": r"^rbac(2)?\.", "$options": "i"}},
        ]
    }
    customer_docs = list(
        db.customers.find(
            customer_query,
            {"_id": 0, "customer_id": 1, "name": 1, "email": 1},
        ).limit(5000)
    )
    summary["candidates"]["customers"] = customer_docs
    if customer_docs:
        customer_ids = [doc["customer_id"] for doc in customer_docs if doc.get("customer_id")]
        result = db.customers.delete_many({"customer_id": {"$in": customer_ids}})
        summary["deleted"]["customers"] = {"count": result.deleted_count, "ids": customer_ids}

    product_query = {
        "$or": [
            {"name": {"$regex": r"^RBAC(2)?\s*Product", "$options": "i"}},
            {"sku": {"$regex": r"^(RB2-|RBAC-)", "$options": "i"}},
            {"brand": {"$regex": r"^RBAC$", "$options": "i"}},
        ]
    }
    product_docs = list(
        db.products.find(
            product_query,
            {"_id": 0, "product_id": 1, "sku": 1, "name": 1},
        ).limit(5000)
    )
    summary["candidates"]["products"] = product_docs
    if product_docs:
        product_ids = [doc["product_id"] for doc in product_docs if doc.get("product_id")]
        result = db.products.delete_many({"product_id": {"$in": product_ids}})
        summary["deleted"]["products"] = {"count": result.deleted_count, "ids": product_ids}
        inv = db.inventory.delete_many({"product_id": {"$in": product_ids}})
        summary["deleted"]["inventory_rows_by_product"] = {"count": inv.deleted_count}

    user_query = {
        "$or": [
            {"email": {"$regex": r"^test_.*@local$", "$options": "i"}},
            {"email": {"$regex": r"^test\..*@mundodeaccesorios\.com$", "$options": "i"}},
            {"email": {"$regex": r"^test\..*@local$", "$options": "i"}},
            {"name": {"$regex": r"^Test\s+", "$options": "i"}},
            {"name": {"$regex": r"^Admin\s+Test$", "$options": "i"}},
            {"name": {"$regex": r"^TEST_PinUser_", "$options": "i"}},
            {"email": {"$regex": r"^rbac(2)?\.", "$options": "i"}},
            {"name": {"$regex": r"^RBAC", "$options": "i"}},
        ]
    }
    user_docs = list(
        db.users.find(
            user_query,
            {"_id": 0, "user_id": 1, "name": 1, "email": 1},
        ).limit(5000)
    )
    summary["candidates"]["users"] = user_docs
    if user_docs:
        user_ids = [doc["user_id"] for doc in user_docs if doc.get("user_id")]
        result = db.users.delete_many({"user_id": {"$in": user_ids}})
        summary["deleted"]["users"] = {"count": result.deleted_count, "ids": user_ids}

        if "sessions" in db.list_collection_names():
            session_result = db.sessions.delete_many({"user_id": {"$in": user_ids}})
            summary["deleted"]["sessions"] = {"count": session_result.deleted_count}

        if "user_sessions" in db.list_collection_names():
            user_session_result = db.user_sessions.delete_many({"user_id": {"$in": user_ids}})
            summary["deleted"]["user_sessions"] = {"count": user_session_result.deleted_count}

        for collection_name in ["user_permissions", "permissions_user_overrides", "permissions_users"]:
            if collection_name in db.list_collection_names():
                perm_result = db[collection_name].delete_many({"user_id": {"$in": user_ids}})
                summary["deleted"][collection_name] = {"count": perm_result.deleted_count}

    print("=== CLEANUP SUMMARY ===")
    pprint(summary)


if __name__ == "__main__":
    main()
