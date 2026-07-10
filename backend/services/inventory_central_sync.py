from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks

logger = logging.getLogger("erp.inventory_central_sync")


class InventoryCentralSyncService:
    """Réplica asíncrona del inventario físico local hacia MongoDB Atlas central."""

    def __init__(
        self,
        local_db,
        central_db,
        deployment_branch_id: Optional[str] = None,
    ):
        self.local_db = local_db
        self.central_db = central_db
        self.deployment_branch_id = (deployment_branch_id or "").strip() or None
        self._branch_name_cache: Dict[str, str] = {}

    @property
    def enabled(self) -> bool:
        return self.central_db is not None

    async def resolve_branch_name(self, branch_id: Optional[str]) -> str:
        bid = str(branch_id or self.deployment_branch_id or "").strip()
        if not bid:
            return ""
        if bid in self._branch_name_cache:
            return self._branch_name_cache[bid]
        branch_doc = await self.local_db.branches.find_one(
            {"branch_id": bid},
            {"_id": 0, "name": 1},
        )
        name = str((branch_doc or {}).get("name") or bid)
        self._branch_name_cache[bid] = name
        return name

    async def resolve_warehouse_branch(self, warehouse_id: str) -> Dict[str, str]:
        warehouse = await self.local_db.warehouses.find_one(
            {"warehouse_id": warehouse_id},
            {"_id": 0, "branch_id": 1, "name": 1},
        )
        branch_id = str(
            (warehouse or {}).get("branch_id")
            or self.deployment_branch_id
            or ""
        ).strip()
        branch_name = await self.resolve_branch_name(branch_id)
        return {
            "branch_id": branch_id,
            "branch_name": branch_name,
            "warehouse_name": str((warehouse or {}).get("name") or warehouse_id),
        }

    async def upsert_inventory_snapshot(
        self,
        *,
        product_id: str,
        warehouse_id: str,
        quantity: int,
        min_stock: Optional[int] = None,
        branch_id: Optional[str] = None,
        branch_name: Optional[str] = None,
        source_event: str = "inventory_sync",
        reference_id: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return

        warehouse_meta = await self.resolve_warehouse_branch(warehouse_id)
        resolved_branch_id = branch_id or warehouse_meta["branch_id"]
        resolved_branch_name = branch_name or warehouse_meta["branch_name"] or resolved_branch_id
        if not resolved_branch_id:
            logger.warning(
                "Skipping central inventory sync without branch_id (product=%s warehouse=%s)",
                product_id,
                warehouse_id,
            )
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        payload: Dict[str, Any] = {
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "warehouse_name": warehouse_meta["warehouse_name"],
            "branch_id": resolved_branch_id,
            "branch_name": resolved_branch_name,
            "quantity": int(quantity),
            "min_stock": int(min_stock if min_stock is not None else 5),
            "source_branch_id": self.deployment_branch_id or resolved_branch_id,
            "source_event": source_event,
            "reference_id": reference_id,
            "last_updated": now_iso,
            "replicated_at": now_iso,
        }

        await self.central_db.inventory.update_one(
            {
                "branch_id": resolved_branch_id,
                "warehouse_id": warehouse_id,
                "product_id": product_id,
            },
            {"$set": payload},
            upsert=True,
        )

    async def replicate_from_local_row(
        self,
        *,
        product_id: str,
        warehouse_id: str,
        source_event: str,
        reference_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        branch_name: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        row = await self.local_db.inventory.find_one(
            {"product_id": product_id, "warehouse_id": warehouse_id},
            {"_id": 0},
        )
        quantity = int((row or {}).get("quantity") or 0)
        min_stock = int((row or {}).get("min_stock") or 5)
        await self.upsert_inventory_snapshot(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=quantity,
            min_stock=min_stock,
            branch_id=branch_id,
            branch_name=branch_name,
            source_event=source_event,
            reference_id=reference_id,
        )

    def schedule_replicate(
        self,
        background_tasks: Optional[BackgroundTasks],
        *,
        product_id: str,
        warehouse_id: str,
        source_event: str,
        reference_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        branch_name: Optional[str] = None,
    ) -> None:
        if not self.enabled or background_tasks is None:
            return
        background_tasks.add_task(
            self.replicate_from_local_row,
            product_id=product_id,
            warehouse_id=warehouse_id,
            source_event=source_event,
            reference_id=reference_id,
            branch_id=branch_id,
            branch_name=branch_name,
        )

    def schedule_many(
        self,
        background_tasks: Optional[BackgroundTasks],
        rows: List[Dict[str, Any]],
    ) -> None:
        for row in rows:
            self.schedule_replicate(
                background_tasks,
                product_id=str(row.get("product_id") or ""),
                warehouse_id=str(row.get("warehouse_id") or ""),
                source_event=str(row.get("source_event") or "inventory_sync"),
                reference_id=row.get("reference_id"),
                branch_id=row.get("branch_id"),
                branch_name=row.get("branch_name"),
            )

    async def fetch_other_branches_inventory(
        self,
        *,
        current_branch_id: str,
        product_id: Optional[str] = None,
        limit: int = 5000,
    ) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        query: Dict[str, Any] = {
            "branch_id": {"$ne": current_branch_id},
            "quantity": {"$gt": 0},
        }
        if product_id:
            query["product_id"] = product_id

        rows = await self.central_db.inventory.find(query, {"_id": 0}).to_list(limit)
        for row in rows:
            product = await self.local_db.products.find_one(
                {"product_id": row.get("product_id")},
                {"_id": 0, "product_id": 1, "name": 1, "sku": 1, "barcode": 1},
            )
            if product:
                row["product"] = product
        return rows

    async def replicate_sale_document(self, sale_id: str) -> None:
        if not self.enabled or not sale_id:
            return
        sale = await self.local_db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
        if not sale:
            return
        branch_id = str(sale.get("branch_id") or self.deployment_branch_id or "").strip()
        if branch_id and not sale.get("branch_name"):
            sale["branch_name"] = await self.resolve_branch_name(branch_id)
        sale["replicated_at"] = datetime.now(timezone.utc).isoformat()
        sale["source_branch_id"] = self.deployment_branch_id or branch_id
        await self.central_db.sales.update_one(
            {"sale_id": sale_id},
            {"$set": sale},
            upsert=True,
        )