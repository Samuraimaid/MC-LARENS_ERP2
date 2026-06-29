"""Smoke test vehicle thumbnail API."""
import json
import urllib.request

BASE = "http://localhost:8001/api"


def get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}") as resp:
        return resp.status, resp.read()


def main():
    status, body = get("/vehicle-thumbnails/manifest")
    manifest = json.loads(body.decode("utf-8"))
    print("manifest_status", status)
    print("types", manifest.get("types"))
    print("assets", len(manifest.get("assets") or {}))

    for slug in ["sedan", "suv", "hatchback", "camioneta-1-cabina", "cabezal"]:
        img_status, img = get(f"/vehicle-thumbnails/{slug}.png")
        print(f"{slug}: status={img_status} bytes={len(img)}")

    resolve_payload = json.dumps({"vehicle_type": "Camioneta Doble Cabina"}).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/settings/vehicle-thumbnails/resolve",
        data=resolve_payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print("resolve", json.loads(resp.read().decode("utf-8")))
    except Exception as exc:
        print("resolve_requires_auth", exc)


if __name__ == "__main__":
    main()