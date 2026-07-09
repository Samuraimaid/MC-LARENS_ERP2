import json

import httpx

BASE = "http://127.0.0.1:8001/api"


def main() -> None:
    client = httpx.Client(timeout=60.0, follow_redirects=True)
    client.post(f"{BASE}/auth/pin/login", json={"pin": "11223344"})
    session_payload = client.get(f"{BASE}/caja/sesion-activa").json()
    session = session_payload.get("session") or session_payload
    session_id = session.get("session_id")
    if not session_id:
        print(json.dumps({"error": "no active session"}))
        return

    arqueo = client.get(
        f"{BASE}/caja/arqueo/{session_id}",
        params={"include_theoretical": True},
    )
    data = arqueo.json() if arqueo.status_code == 200 else {"status": arqueo.status_code}
    print(
        json.dumps(
            {
                "session_id": session_id,
                "usd_to_nio_rate": data.get("usd_to_nio_rate"),
                "resumen_entradas": data.get("resumen_entradas"),
                "expected_by_currency": data.get("expected_by_currency"),
                "saldo_teorico_nio": data.get("saldo_teorico_nio"),
                "comparativo": data.get("comparativo"),
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()