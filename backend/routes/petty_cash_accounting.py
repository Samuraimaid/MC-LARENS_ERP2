from __future__ import annotations

import uuid
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, cast

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from backend.domains.billing.accounting import (
    build_accounting_summary,
    build_reconciliation_report,
    list_payment_flow,
    list_purchases_and_expenses,
)
from backend.domains.billing.branch_settings import normalize_billing_branch_id
from backend.domains.billing.petty_cash import (
    PAYABLE_STATUSES,
    compute_fund_snapshot,
    initial_expense_status,
    next_voucher_number,
    round_money,
    serialize_expense_for_pdf,
    validate_expense_payload,
)
from backend.domains.billing.petty_cash_settings import (
    merge_petty_cash_settings,
    normalize_petty_cash_settings,
    petty_cash_settings_query,
    seed_petty_cash_settings_doc,
)
from backend.domains.export.dependencies import get_openpyxl_symbols, get_reportlab_symbols
from backend.domains.export.pdf_documents import (
    draw_petty_cash_voucher_pdf,
    normalize_pdf_document_settings,
    resolve_petty_cash_theme,
)


def get_petty_cash_accounting_router(
    db,
    require_auth,
    require_roles,
    require_cashier_roles,
    get_billing_pdf_settings,
    build_preview_company_for_branch,
    currencies,
    logger,
    FlexibleModel,
):
    router = APIRouter()

    ACCOUNTING_ROLES = ["gerencia", "recursos_humanos", "supervisor"]
    ACCOUNTING_WRITE_ROLES = ["gerencia", "recursos_humanos"]
    APPROVAL_ROLES = ["gerencia"]
    PAY_ROLES = ["gerencia", "cajero", "supervisor"]

    class PettyCashSettingsUpdate(FlexibleModel):
        fund_amount: Optional[float] = None
        currency: Optional[str] = None
        monthly_cap: Optional[float] = None
        low_balance_threshold_pct: Optional[float] = None
        requires_approval_above: Optional[float] = None
        voucher_prefix: Optional[str] = None
        allowed_categories: Optional[List[str]] = None

    class PettyCashExpenseCreate(FlexibleModel):
        branch_id: Optional[str] = None
        category: str = "otros"
        description: str = ""
        beneficiary: str = ""
        employee_user_id: Optional[str] = None
        amount: float = 0.0
        currency: Optional[str] = None
        payment_method: str = "cash"
        received_by: Optional[str] = None
        notes: Optional[str] = None
        session_id: Optional[str] = None
        submit: bool = False

    class PettyCashExpenseUpdate(FlexibleModel):
        category: Optional[str] = None
        description: Optional[str] = None
        beneficiary: Optional[str] = None
        amount: Optional[float] = None
        payment_method: Optional[str] = None
        received_by: Optional[str] = None
        notes: Optional[str] = None

    class PettyCashRejectPayload(FlexibleModel):
        reason: Optional[str] = None

    class PettyCashReplenishmentCreate(FlexibleModel):
        branch_id: Optional[str] = None
        amount: float = 0.0
        reference: Optional[str] = None
        notes: Optional[str] = None

    async def _resolve_branch(user, requested_branch_id: Optional[str] = None) -> str:
        role = str(getattr(user, "role", "") or "").lower()
        requested = normalize_billing_branch_id(requested_branch_id or getattr(user, "branch_id", None))
        if role in {"gerencia", "recursos_humanos"}:
            exists = await db.branches.find_one({"branch_id": requested}, {"_id": 0, "branch_id": 1})
            if exists:
                return requested
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        user_branch = normalize_billing_branch_id(getattr(user, "branch_id", None))
        if requested != user_branch:
            raise HTTPException(status_code=403, detail="No puedes operar otra sucursal")
        return user_branch

    async def _get_settings_doc(branch_id: str) -> Dict[str, Any]:
        doc = await db.settings.find_one(petty_cash_settings_query(branch_id), {"_id": 0})
        if doc:
            return doc
        seeded = seed_petty_cash_settings_doc(branch_id=branch_id)
        await db.settings.update_one(petty_cash_settings_query(branch_id), {"$set": seeded}, upsert=True)
        return seeded

    async def _get_settings(branch_id: str) -> Dict[str, Any]:
        return normalize_petty_cash_settings((await _get_settings_doc(branch_id)))

    async def _get_expense(expense_id: str) -> Dict[str, Any]:
        doc = await db.petty_cash_expenses.find_one({"expense_id": expense_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Gasto de caja chica no encontrado")
        return cast(Dict[str, Any], doc)

    @router.get("/settings/petty-cash")
    async def get_petty_cash_settings(request: Request, branch_id: str = ""):
        user = await require_roles(request, ACCOUNTING_WRITE_ROLES + ["supervisor"])
        resolved_branch = await _resolve_branch(user, branch_id or None)
        doc = await _get_settings_doc(resolved_branch)
        return {
            "branch_id": resolved_branch,
            "petty_cash_settings": normalize_petty_cash_settings(doc),
        }

    @router.put("/settings/petty-cash")
    async def update_petty_cash_settings(payload: PettyCashSettingsUpdate, request: Request, branch_id: str = ""):
        user = await require_roles(request, ACCOUNTING_WRITE_ROLES)
        resolved_branch = await _resolve_branch(user, branch_id or None)
        current = normalize_petty_cash_settings((await _get_settings_doc(resolved_branch)))
        merged = merge_petty_cash_settings(current, payload.model_dump(exclude_none=True))
        doc = {
            **petty_cash_settings_query(resolved_branch),
            **merged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.user_id,
        }
        await db.settings.update_one(petty_cash_settings_query(resolved_branch), {"$set": doc}, upsert=True)
        return {"message": "Configuración de caja chica actualizada", "branch_id": resolved_branch, "petty_cash_settings": merged}

    @router.get("/petty-cash/fund")
    async def get_petty_cash_fund(request: Request, branch_id: str = ""):
        user = await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        resolved_branch = await _resolve_branch(user, branch_id or None)
        settings = await _get_settings(resolved_branch)
        snapshot = await compute_fund_snapshot(db, branch_id=resolved_branch, settings=settings)
        return {"branch_id": resolved_branch, "settings": settings, "fund": snapshot}

    @router.get("/petty-cash/expenses")
    async def list_petty_cash_expenses(
        request: Request,
        branch_id: str = "",
        status: str = "",
        category: str = "",
        start_date: str = "",
        end_date: str = "",
    ):
        user = await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        resolved_branch = await _resolve_branch(user, branch_id or None)
        query: Dict[str, Any] = {"branch_id": resolved_branch}
        if status:
            query["status"] = status.strip().lower()
        if category:
            query["category"] = category.strip().lower()
        rows = await db.petty_cash_expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        if start_date or end_date:
            filtered = []
            for row in rows:
                stamp = row.get("paid_at") or row.get("created_at")
                if start_date and str(stamp or "") < start_date:
                    continue
                if end_date and str(stamp or "")[:10] > end_date[:10]:
                    continue
                filtered.append(row)
            rows = filtered
        return rows

    @router.post("/petty-cash/expenses")
    async def create_petty_cash_expense(payload: PettyCashExpenseCreate, request: Request):
        user = await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        resolved_branch = await _resolve_branch(user, payload.branch_id or None)
        settings = await _get_settings(resolved_branch)
        snapshot = await compute_fund_snapshot(db, branch_id=resolved_branch, settings=settings)
        clean, errors = validate_expense_payload(payload.model_dump(), settings=settings, fund_snapshot=snapshot)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))

        existing_docs = await db.petty_cash_expenses.find(
            {"branch_id": resolved_branch},
            {"_id": 0, "voucher_number": 1},
        ).to_list(5000)
        existing_numbers = [str(row.get("voucher_number") or "") for row in existing_docs]
        now_iso = datetime.now(timezone.utc).isoformat()
        status = "draft"
        if payload.submit:
            status = initial_expense_status(clean["amount"], settings)

        doc = {
            "expense_id": f"pcexp_{uuid.uuid4().hex[:10]}",
            "branch_id": resolved_branch,
            "voucher_number": next_voucher_number(prefix=settings["voucher_prefix"], existing_numbers=existing_numbers),
            "status": status,
            "created_by": user.user_id,
            "created_by_name": user.name,
            "created_at": now_iso,
            "updated_at": now_iso,
            **clean,
        }
        await db.petty_cash_expenses.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/petty-cash/expenses/{expense_id}")
    async def get_petty_cash_expense(expense_id: str, request: Request):
        await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        return await _get_expense(expense_id)

    @router.patch("/petty-cash/expenses/{expense_id}")
    async def update_petty_cash_expense(expense_id: str, payload: PettyCashExpenseUpdate, request: Request):
        user = await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") not in {"draft", "pending_approval"}:
            raise HTTPException(status_code=400, detail="Solo se pueden editar gastos en borrador o pendientes de aprobación")
        await _resolve_branch(user, expense.get("branch_id"))
        settings = await _get_settings(expense["branch_id"])
        snapshot = await compute_fund_snapshot(db, branch_id=expense["branch_id"], settings=settings)
        merged_payload = {**expense, **payload.model_dump(exclude_none=True)}
        clean, errors = validate_expense_payload(merged_payload, settings=settings, fund_snapshot=snapshot)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        clean["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.petty_cash_expenses.update_one({"expense_id": expense_id}, {"$set": clean})
        return {**expense, **clean}

    @router.post("/petty-cash/expenses/{expense_id}/submit")
    async def submit_petty_cash_expense(expense_id: str, request: Request):
        user = await require_roles(request, ACCOUNTING_ROLES + PAY_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") != "draft":
            raise HTTPException(status_code=400, detail="Solo se pueden enviar gastos en borrador")
        settings = await _get_settings(expense["branch_id"])
        status = initial_expense_status(round_money(expense.get("amount")), settings)
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.petty_cash_expenses.update_one(
            {"expense_id": expense_id},
            {"$set": {"status": status, "submitted_at": now_iso, "updated_at": now_iso, "submitted_by": user.user_id}},
        )
        expense["status"] = status
        return expense

    @router.post("/petty-cash/expenses/{expense_id}/approve")
    async def approve_petty_cash_expense(expense_id: str, request: Request):
        user = await require_roles(request, APPROVAL_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") != "pending_approval":
            raise HTTPException(status_code=400, detail="El gasto no está pendiente de aprobación")
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.petty_cash_expenses.update_one(
            {"expense_id": expense_id},
            {
                "$set": {
                    "status": "approved",
                    "approved_at": now_iso,
                    "approved_by": user.user_id,
                    "approved_by_name": user.name,
                    "updated_at": now_iso,
                }
            },
        )
        expense.update({"status": "approved", "approved_by_name": user.name})
        return expense

    @router.post("/petty-cash/expenses/{expense_id}/reject")
    async def reject_petty_cash_expense(expense_id: str, payload: PettyCashRejectPayload, request: Request):
        user = await require_roles(request, APPROVAL_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") != "pending_approval":
            raise HTTPException(status_code=400, detail="El gasto no está pendiente de aprobación")
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.petty_cash_expenses.update_one(
            {"expense_id": expense_id},
            {
                "$set": {
                    "status": "rejected",
                    "rejected_at": now_iso,
                    "rejected_by": user.user_id,
                    "rejected_by_name": user.name,
                    "rejection_reason": payload.reason or "",
                    "updated_at": now_iso,
                }
            },
        )
        expense.update({"status": "rejected"})
        return expense

    @router.post("/petty-cash/expenses/{expense_id}/pay")
    async def pay_petty_cash_expense(expense_id: str, request: Request):
        user = await require_roles(request, PAY_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") not in PAYABLE_STATUSES:
            raise HTTPException(status_code=400, detail="El gasto no está aprobado para pago")
        settings = await _get_settings(expense["branch_id"])
        snapshot = await compute_fund_snapshot(db, branch_id=expense["branch_id"], settings=settings)
        clean, errors = validate_expense_payload(expense, settings=settings, fund_snapshot=snapshot, for_payment=True)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))

        now_iso = datetime.now(timezone.utc).isoformat()
        session_id = expense.get("session_id")
        movement_id = None
        if session_id:
            session = await db.caja_sesiones.find_one({"session_id": session_id, "estado": "abierta"}, {"_id": 0})
            if session:
                movement_id = f"cmov_{uuid.uuid4().hex[:10]}"
                await db.caja_movimientos.insert_one({
                    "movement_id": movement_id,
                    "session_id": session_id,
                    "branch_id": expense.get("branch_id"),
                    "caja_id": session.get("caja_id"),
                    "tipo": "salida",
                    "monto": round_money(expense.get("amount")),
                    "moneda": expense.get("currency"),
                    "referencia": expense.get("voucher_number"),
                    "observaciones": expense.get("description"),
                    "created_by": user.user_id,
                    "created_by_name": user.name,
                    "created_at": now_iso,
                    "status": "active",
                    "movement_category": "petty_cash",
                    "linked_petty_cash_expense_id": expense_id,
                })

        await db.petty_cash_expenses.update_one(
            {"expense_id": expense_id},
            {
                "$set": {
                    "status": "paid",
                    "paid_at": now_iso,
                    "paid_by": user.user_id,
                    "paid_by_name": user.name,
                    "authorized_by_name": expense.get("approved_by_name") or user.name,
                    "linked_movement_id": movement_id,
                    "updated_at": now_iso,
                }
            },
        )
        expense.update({"status": "paid", "paid_at": now_iso, "paid_by_name": user.name})
        return expense

    @router.post("/petty-cash/expenses/{expense_id}/void")
    async def void_petty_cash_expense(expense_id: str, request: Request):
        user = await require_roles(request, ACCOUNTING_WRITE_ROLES)
        expense = await _get_expense(expense_id)
        if expense.get("status") == "paid":
            raise HTTPException(status_code=400, detail="No se puede anular un gasto ya pagado")
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.petty_cash_expenses.update_one(
            {"expense_id": expense_id},
            {"$set": {"status": "voided", "voided_at": now_iso, "voided_by": user.user_id, "updated_at": now_iso}},
        )
        expense["status"] = "voided"
        return expense

    @router.get("/petty-cash/replenishments")
    async def list_petty_cash_replenishments(request: Request, branch_id: str = ""):
        user = await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = await _resolve_branch(user, branch_id or None)
        rows = await db.petty_cash_replenishments.find(
            {"branch_id": resolved_branch, "status": "active"},
            {"_id": 0},
        ).sort("created_at", -1).to_list(500)
        return rows

    @router.post("/petty-cash/replenishments")
    async def create_petty_cash_replenishment(payload: PettyCashReplenishmentCreate, request: Request):
        user = await require_roles(request, ACCOUNTING_WRITE_ROLES)
        resolved_branch = await _resolve_branch(user, payload.branch_id or None)
        amount = round_money(payload.amount)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
        settings = await _get_settings(resolved_branch)
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "replenishment_id": f"pcrep_{uuid.uuid4().hex[:10]}",
            "branch_id": resolved_branch,
            "amount": amount,
            "currency": settings["currency"],
            "reference": payload.reference or "",
            "notes": payload.notes or "",
            "status": "active",
            "created_by": user.user_id,
            "created_by_name": user.name,
            "created_at": now_iso,
        }
        await db.petty_cash_replenishments.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/petty-cash/reconciliation")
    async def get_petty_cash_reconciliation(request: Request, branch_id: str = "", week_start: str = ""):
        user = await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = await _resolve_branch(user, branch_id or None)
        settings = await _get_settings(resolved_branch)
        snapshot = await compute_fund_snapshot(db, branch_id=resolved_branch, settings=settings)
        return await build_reconciliation_report(
            db,
            branch_id=resolved_branch,
            week_start=week_start or None,
            fund_snapshot=snapshot,
            settings=settings,
        )

    async def _resolve_summary_branch(user, requested_branch_id: Optional[str] = None) -> Optional[str]:
        role = str(getattr(user, "role", "") or "").lower()
        if role in {"gerencia", "recursos_humanos"}:
            if requested_branch_id:
                return normalize_billing_branch_id(requested_branch_id)
            return None
        return await _resolve_branch(user, requested_branch_id or None)

    @router.get("/accounting/summary")
    async def get_accounting_summary(
        request: Request,
        branch_id: str = "",
        start_date: str = "",
        end_date: str = "",
    ):
        user = await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = await _resolve_summary_branch(user, branch_id or None)
        fund_branch = resolved_branch or normalize_billing_branch_id(getattr(user, "branch_id", None))
        settings = await _get_settings(fund_branch)
        snapshot = await compute_fund_snapshot(db, branch_id=fund_branch, settings=settings)
        return await build_accounting_summary(
            db,
            branch_id=resolved_branch,
            start_date=start_date or None,
            end_date=end_date or None,
            fund_snapshot=snapshot,
        )

    @router.get("/accounting/purchases-expenses")
    async def get_accounting_purchases_expenses(
        request: Request,
        branch_id: str = "",
        start_date: str = "",
        end_date: str = "",
    ):
        await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = normalize_billing_branch_id(branch_id) if branch_id else None
        return await list_purchases_and_expenses(
            db,
            branch_id=resolved_branch,
            start_date=start_date or None,
            end_date=end_date or None,
        )

    @router.get("/accounting/payments")
    async def get_accounting_payments(
        request: Request,
        branch_id: str = "",
        start_date: str = "",
        end_date: str = "",
    ):
        await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = normalize_billing_branch_id(branch_id) if branch_id else None
        return await list_payment_flow(
            db,
            branch_id=resolved_branch,
            start_date=start_date or None,
            end_date=end_date or None,
        )

    @router.get("/petty-cash/expenses/export")
    async def export_petty_cash_expenses(
        request: Request,
        branch_id: str = "",
        start_date: str = "",
        end_date: str = "",
        format: str = "xlsx",
    ):
        await require_roles(request, ACCOUNTING_ROLES)
        resolved_branch = normalize_billing_branch_id(branch_id) if branch_id else None
        rows = await list_purchases_and_expenses(
            db,
            branch_id=resolved_branch,
            start_date=start_date or None,
            end_date=end_date or None,
        )
        petty_rows = [row for row in rows if row.get("source") == "petty_cash"]
        if format.lower() != "xlsx":
            raise HTTPException(status_code=400, detail="Solo se admite format=xlsx")
        Workbook, _ = get_openpyxl_symbols()
        wb = Workbook()
        ws = wb.active
        ws.title = "CajaChica"
        headers = ["Fecha", "Comprobante", "Categoría", "Concepto", "Beneficiario", "Monto", "Moneda", "Estado", "Sucursal"]
        ws.append(headers)
        for row in petty_rows:
            ws.append([
                row.get("date"),
                row.get("voucher_number"),
                row.get("category"),
                row.get("description"),
                row.get("beneficiary"),
                row.get("amount"),
                row.get("currency"),
                row.get("status"),
                row.get("branch_id"),
            ])
        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="caja_chica_gastos.xlsx"'},
        )

    @router.get("/accounting/export")
    async def export_accounting_workbook(
        request: Request,
        branch_id: str = "",
        start_date: str = "",
        end_date: str = "",
        format: str = "xlsx",
    ):
        await require_roles(request, ACCOUNTING_ROLES)
        if format.lower() != "xlsx":
            raise HTTPException(status_code=400, detail="Solo se admite format=xlsx")
        resolved_branch = normalize_billing_branch_id(branch_id) if branch_id else None
        purchases = await list_purchases_and_expenses(db, branch_id=resolved_branch, start_date=start_date or None, end_date=end_date or None)
        payments = await list_payment_flow(db, branch_id=resolved_branch, start_date=start_date or None, end_date=end_date or None)
        settings = await _get_settings(resolved_branch or normalize_billing_branch_id("branch_main"))
        snapshot = await compute_fund_snapshot(db, branch_id=resolved_branch or normalize_billing_branch_id("branch_main"), settings=settings)
        summary = await build_accounting_summary(db, branch_id=resolved_branch, start_date=start_date or None, end_date=end_date or None, fund_snapshot=snapshot)

        Workbook, _ = get_openpyxl_symbols()
        wb = Workbook()
        ws_summary = wb.active
        ws_summary.title = "Resumen"
        for key, value in summary.items():
            ws_summary.append([key, value])

        ws_exp = wb.create_sheet("ComprasGastos")
        ws_exp.append(["Fuente", "Fecha", "Referencia", "Categoría", "Descripción", "Beneficiario", "Monto", "Moneda", "Estado"])
        for row in purchases:
            ws_exp.append([
                row.get("source"),
                row.get("date"),
                row.get("voucher_number") or row.get("id"),
                row.get("category"),
                row.get("description"),
                row.get("beneficiary"),
                row.get("amount"),
                row.get("currency"),
                row.get("status"),
            ])

        ws_pay = wb.create_sheet("Pagos")
        ws_pay.append(["Fuente", "Fecha", "Referencia", "Descripción", "Monto", "Moneda", "Método"])
        for row in payments:
            ws_pay.append([
                row.get("source"),
                row.get("date"),
                row.get("reference"),
                row.get("description"),
                row.get("amount"),
                row.get("currency"),
                row.get("payment_method"),
            ])

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="contabilidad_export.xlsx"'},
        )

    @router.get("/print/petty-cash-pdf/{expense_id}")
    async def print_petty_cash_pdf(expense_id: str, request: Request):
        await require_auth(request)
        expense = await _get_expense(expense_id)
        if expense.get("status") != "paid":
            raise HTTPException(status_code=400, detail="Solo se puede imprimir un gasto pagado")
        branch = await db.branches.find_one({"branch_id": expense.get("branch_id")}, {"_id": 0}) or {}
        company = await build_preview_company_for_branch(expense.get("branch_id"))
        pdf_settings = await get_billing_pdf_settings(expense.get("branch_id"))
        settings = normalize_pdf_document_settings(pdf_settings)
        theme = resolve_petty_cash_theme(settings)
        _, letter, _, canvas = get_reportlab_symbols()
        buffer = BytesIO()
        page = canvas.Canvas(buffer, pagesize=letter)
        draw_petty_cash_voucher_pdf(
            page,
            expense=serialize_expense_for_pdf(expense, branch_name=branch.get("name") or company.get("name")),
            company=company,
            currencies=currencies,
            logger=logger,
            pdf_settings=settings,
            document_theme=theme,
        )
        page.save()
        buffer.seek(0)
        voucher = expense.get("voucher_number") or expense_id
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="caja_chica_{voucher}.pdf"'},
        )

    return router