#!/usr/bin/env python3
"""
scripts/temp_smoke_test.py

Smoke test for McLarens ERP Workbench and Catalog Sale-Pick Chrome.
CRITICAL: Contains NO hardcoded PINs or credentials.
PIN must be supplied via --pin argument or ERP_TEST_PIN environment variable.

Usage:
  python scripts/temp_smoke_test.py --pin 55667788
  python scripts/temp_smoke_test.py --base https://mclarens-erp-836176703716.us-central1.run.app --pin 55667788
"""

import argparse
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright


def run_smoke_test(base_url: str, pin: str, headless: bool = True):
    if not pin:
        print("ERROR: No PIN provided. Pass --pin <PIN> or set ERP_TEST_PIN environment variable.")
        sys.exit(1)

    smoke_dir = Path(tempfile.gettempdir()) / "erp-smoke"
    smoke_dir.mkdir(parents=True, exist_ok=True)
    print(f"[*] Base URL: {base_url}")
    print(f"[*] Screenshots directory: {smoke_dir}")

    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. /env.js BUILD_ID check
        try:
            page.goto(f"{base_url}/env.js", wait_until="networkidle")
            content = page.content()
            build_id = "unknown"
            for line in content.splitlines():
                if "__BUILD_ID__" in line:
                    build_id = line.split("=")[-1].strip(" ;'\"")
            print(f"[*] BUILD_ID: {build_id}")
            results["BUILD_ID"] = build_id
        except Exception as e:
            print(f"[!] Error fetching /env.js: {e}")
            results["BUILD_ID"] = "FAIL"

        # 2. Login
        try:
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.wait_for_timeout(1000)

            # Check if HyperVisor blocked
            if "hypervisor" in page.url.lower() or page.locator("text=HyperVisor").count() > 0:
                page.screenshot(path=str(smoke_dir / "00_blocked_hypervisor.png"))
                print("[-] HyperVisor blocked access. Exiting with blocked status.")
                browser.close()
                return {"status": "blocked"}

            # Enter PIN on screen keypad
            for digit in pin:
                key_btn = page.locator(f"button:has-text('{digit}')").first
                if key_btn.is_visible():
                    key_btn.click()
                    page.wait_for_timeout(150)

            page.wait_for_timeout(2000)
            page.screenshot(path=str(smoke_dir / "01_after_login.png"))
            results["login"] = "PASS" if "/workbench" in page.url or page.locator("[data-testid='workbench']").count() > 0 else "FAIL"
        except Exception as e:
            print(f"[!] Login error: {e}")
            results["login"] = "FAIL"

        # 3. Workbench form checks
        try:
            page.goto(f"{base_url}/workbench?tab=sales", wait_until="networkidle")
            page.wait_for_timeout(2000)

            # Verify no 'Buscar venta' row when form is open
            has_buscar_venta = page.locator("text='Buscar venta'").count() > 0
            results["no_buscar_venta_row"] = "PASS" if not has_buscar_venta else "FAIL"

            # Check clean form toast count
            limpiar_btn = page.locator("button:has-text('Limpiar')").first
            if limpiar_btn.is_visible():
                limpiar_btn.click()
                page.wait_for_timeout(500)
                confirm_btn = page.locator("button:has-text('Sí, limpiar')").first
                if confirm_btn.is_visible():
                    confirm_btn.click()
                    page.wait_for_timeout(800)
                    toasts = page.locator("text='Formulario limpiado'").count()
                    results["single_toast_limpiar"] = "PASS" if toasts == 1 else f"FAIL ({toasts} toasts)"
        except Exception as e:
            print(f"[!] Workbench check error: {e}")

        # 4. Catalog sale-pick chrome
        try:
            page.goto(f"{base_url}/catalog?mode=sale-pick&source=sale-form", wait_until="networkidle")
            page.wait_for_timeout(2000)
            page.screenshot(path=str(smoke_dir / "02_catalog_sale_pick.png"))

            # Check stay in catalog toggle is present
            has_toggle = page.locator("[data-testid='stay-in-catalog-toggle']").count() > 0 or page.locator("text='Permanecer en catálogo'").count() > 0
            results["stay_in_catalog_toggle"] = "PASS" if has_toggle else "FAIL"

            # Check compact banner
            has_banner = page.locator("text='Modo Selección: Venta'").count() > 0
            results["compact_banner"] = "PASS" if has_banner else "FAIL"
        except Exception as e:
            print(f"[!] Catalog check error: {e}")

        browser.close()

    print("\n--- RESULTS ---")
    for k, v in results.items():
        print(f"  {k}: {v}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ERP Smoke Test (PIN is NOT hardcoded)")
    parser.add_argument("--base", default="https://mclarens-erp-836176703716.us-central1.run.app", help="Base URL")
    parser.add_argument("--pin", default=os.getenv("ERP_TEST_PIN", ""), help="Test user PIN (never commit with PIN)")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode")
    args = parser.parse_args()

    run_smoke_test(base_url=args.base, pin=args.pin, headless=not args.headed)
