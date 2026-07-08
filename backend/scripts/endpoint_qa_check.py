import json

import httpx

BASE = "http://127.0.0.1:8001/api"


def main() -> None:
    client = httpx.Client(timeout=600.0, follow_redirects=True)
    client.post(f"{BASE}/auth/pin/login", json={"pin": "01011990"})

    dual = client.get(f"{BASE}/currencies/usd-nio-dual")
    unauth = httpx.Client(timeout=60.0)
    warr_unauth = unauth.get(f"{BASE}/warranties/lookup", params={"code": "INV-TEST"})
    unauth.close()

    warr_invalid = client.get(f"{BASE}/warranties/lookup", params={"code": "not-valid-scan"})
    qa = client.post(f"{BASE}/qa/run-full-simulation-suite")

    qa_body = qa.json() if qa.status_code == 200 else {}
    company_tx = next(
        (row for row in (qa_body.get("transactions") or []) if row.get("apply_iva")),
        None,
    )
    client.post(f"{BASE}/auth/pin/login", json={"pin": "11223344"})
    api_pdf = None
    if company_tx and company_tx.get("sale_id"):
        live_pdf = client.get(f"{BASE}/print/invoice-pdf/{company_tx['sale_id']}")
        api_pdf = {
            "status": live_pdf.status_code,
            "bytes": len(live_pdf.content or b""),
            "sale_id": company_tx["sale_id"],
            "pdf_header": (live_pdf.content or b"")[:4] == b"%PDF",
        }

    client.post(f"{BASE}/auth/pin/login", json={"pin": "01011990"})
    warranty_paid_lookup = None
    if company_tx and company_tx.get("invoice_number"):
        lookup = client.get(
            f"{BASE}/warranties/lookup",
            params={"code": company_tx["invoice_number"]},
        )
        warranty_paid_lookup = {
            "status": lookup.status_code,
            "invoice": company_tx["invoice_number"],
        }

    result = {
        "dual_rates": {
            "status": dual.status_code,
            "ok": dual.status_code == 200,
            "body": dual.json() if dual.status_code == 200 else dual.text[:200],
        },
        "warranties_route": {
            "unauth_status": warr_unauth.status_code,
            "invalid_status": warr_invalid.status_code,
            "route_ok": warr_unauth.status_code != 404,
        },
        "qa_suite": {
            "status": qa.status_code,
            "ok": bool(qa_body.get("ok")),
            "summary": qa_body.get("summary"),
            "errors": len(qa_body.get("errors") or []),
        },
        "warranty_lookup_paid": warranty_paid_lookup,
        "letter_pdf_api": api_pdf,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    client.close()


if __name__ == "__main__":
    main()