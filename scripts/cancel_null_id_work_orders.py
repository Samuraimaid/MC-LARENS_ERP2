#!/usr/bin/env python3
"""
One-shot safe maintenance script:
Cancela cualquier orden de trabajo en MongoDB con work_order_id null, vacío o inexistente
para evitar que contaminen el KDS de instalaciones o la vista operativa.
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient


def cancel_orphan_work_orders(mongo_url: str, db_name: str) -> int:
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    now_iso = datetime.now(timezone.utc).isoformat()
    filter_query = {
        "$or": [
            {"work_order_id": None},
            {"work_order_id": ""},
            {"work_order_id": {"$exists": False}},
        ],
        "status": {"$ne": "cancelled"},
    }
    update_op = {
        "$set": {
            "status": "cancelled",
            "cancellation_reason": "auto_cancelled_null_work_order_id",
            "notes": "Cancelada automáticamente por higiene: work_order_id nulo/inválido [AUDIT_SMOKE]",
            "updated_at": now_iso,
        }
    }

    total_matching = db.work_orders.count_documents(filter_query)
    print(f"Encontradas {total_matching} órdenes de trabajo huérfanas sin work_order_id válido.")

    if total_matching == 0:
        print("No hay órdenes de trabajo para cancelar. Base de datos limpia.")
        return 0

    res = db.work_orders.update_many(filter_query, update_op)
    print(f"Canceladas exitosamente {res.modified_count} órdenes de trabajo huérfanas.")
    return res.modified_count


def main():
    parser = argparse.ArgumentParser(description="Cancelar órdenes de trabajo con work_order_id null.")
    parser.add_argument("--mongo-url", default=os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017")
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "mc-larens2_mundo_accesorios_erp"))
    args = parser.parse_args()

    try:
        count = cancel_orphan_work_orders(args.mongo_url, args.db_name)
        sys.exit(0)
    except Exception as e:
        print(f"Error ejecutando cancelación de órdenes huérfanas: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
