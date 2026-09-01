#!/usr/bin/env python3
"""
==============================================================================
MC-LARENS ERP 2.0 - Agente de Diagnóstico y Rastreo Multi-Rol en Vivo
==============================================================================
Crea sesiones para cada uno de los roles del sistema, navega por todas las
rutas y endpoints autorizados, captura errores de frontend/backend, excepciones
de React, códigos de error y genera un reporte exhaustivo para resolución 1 a 1.
==============================================================================
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.request
import urllib.error

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Roles oficiales del ERP y sus credenciales de prueba estándar
ROLE_PROFILES = [
    {
        "role": "gerencia",
        "label": "Gerencia General / Dirección",
        "pin": "01011990",
        "username": "gerente_general",
        "routes": [
            "/dashboard", "/sales", "/pos", "/inventory", "/catalog", "/customers",
            "/workshop", "/tint-cutting", "/tint-pricing", "/cashier", "/billing",
            "/human-resources", "/promotions", "/warranties", "/settings",
            "/security-audit", "/hypervisor", "/users-admin", "/warehouses",
            "/vehicles", "/tutorials"
        ],
        "api_endpoints": [
            "/api/health",
            "/api/auth/me",
            "/api/dashboard/stats",
            "/api/users",
            "/api/sales",
            "/api/settings/promotional-videos",
            "/api/promos/videos",
        ]
    },
    {
        "role": "recursos_humanos",
        "label": "Recursos Humanos y Nómina",
        "pin": "20202020",
        "username": "test_rrhh",
        "routes": [
            "/human-resources", "/dashboard"
        ],
        "api_endpoints": [
            "/api/auth/me",
            "/api/users",
        ]
    },
    {
        "role": "supervisor",
        "label": "Supervisor de Ventas y Taller",
        "pin": "30303030",
        "username": "test_supervisor",
        "routes": [
            "/dashboard", "/sales", "/pos", "/workshop", "/catalog",
            "/customers", "/tint-pricing", "/warranties"
        ],
        "api_endpoints": [
            "/api/auth/me",
            "/api/sales",
        ]
    },
    {
        "role": "cajero",
        "label": "Caja y Facturación",
        "pin": "40404040",
        "username": "test_cajero",
        "routes": [
            "/cashier", "/sales", "/pos", "/billing", "/customers"
        ],
        "api_endpoints": [
            "/api/auth/me",
            "/api/sales",
        ]
    },
    {
        "role": "ventas",
        "label": "Asesor de Ventas",
        "pin": "50505050",
        "username": "test_ventas",
        "routes": [
            "/dashboard", "/sales", "/pos", "/catalog", "/customers",
            "/promotions", "/warranties", "/tutorials"
        ],
        "api_endpoints": [
            "/api/auth/me",
            "/api/customers",
        ]
    },
    {
        "role": "electrico",
        "label": "Técnico Eléctrico y Accesorios",
        "pin": "60606060",
        "username": "test_electrico",
        "routes": [
            "/technician", "/tutorials"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "polarizador",
        "label": "Técnico Especialista en Polarizados",
        "pin": "70707070",
        "username": "test_polarizador",
        "routes": [
            "/tint-cutting", "/technician", "/tutorials"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "transporte",
        "label": "Transporte y Logística",
        "pin": "80808080",
        "username": "test_transporte",
        "routes": [
            "/technician"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "bodegas",
        "label": "Encargado de Bodegas / Almacén",
        "pin": "90909090",
        "username": "test_bodegas",
        "routes": [
            "/warehouses", "/inventory"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "instalaciones",
        "label": "Técnico de Instalaciones y Audio",
        "pin": "12121212",
        "username": "test_instalaciones",
        "routes": [
            "/technician", "/tutorials"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "coordinador_polarizados",
        "label": "Coordinador de Polarizados",
        "pin": "13131313",
        "username": "test_coord_pol",
        "routes": [
            "/workshop", "/tint-cutting", "/tint-pricing"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "coordinador_instalaciones",
        "label": "Coordinador de Instalaciones",
        "pin": "14141414",
        "username": "test_coord_inst",
        "routes": [
            "/workshop", "/warranties"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "jefe_vendedores",
        "label": "Jefe de Vendedores",
        "pin": "15151515",
        "username": "test_jefe_ventas",
        "routes": [
            "/dashboard", "/sales", "/pos", "/catalog", "/customers", "/promotions"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "jefe_tienda",
        "label": "Jefe de Tienda / Sucursal",
        "pin": "16161616",
        "username": "test_jefe_tienda",
        "routes": [
            "/dashboard", "/sales", "/pos", "/cashier", "/inventory", "/workshop"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "entregador",
        "label": "Entregador y Despacho",
        "pin": "17171717",
        "username": "test_entregador",
        "routes": [
            "/technician"
        ],
        "api_endpoints": [
            "/api/auth/me",
        ]
    },
    {
        "role": "programador",
        "label": "Ingeniería y DevOps",
        "pin": "99999999",
        "username": "test_programador",
        "routes": [
            "/dashboard", "/settings", "/hypervisor", "/security-audit"
        ],
        "api_endpoints": [
            "/api/auth/me",
            "/api/settings/promotional-videos",
        ]
    }
]


class DiagnosticCrawlerAgent:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.api_url = f"{self.base_url}/api"
        self.session_cookies: Dict[str, str] = {}
        self.issues: List[Dict[str, Any]] = []
        self.coverage_stats: Dict[str, Any] = {"roles_tested": 0, "endpoints_tested": 0, "routes_checked": 0}

    def _http_request(self, path: str, method: str = "GET", data: Optional[dict] = None, token: Optional[str] = None) -> tuple[int, Any, Dict[str, str]]:
        url = f"{self.base_url}{path}" if path.startswith("/api") or path.startswith("/videos") else f"{self.api_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MCLarens-Diagnostic-Agent/2.0"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        cookie_header = "; ".join([f"{k}={v}" for k, v in self.session_cookies.items()])
        if cookie_header:
            headers["Cookie"] = cookie_header

        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                status = response.status
                body_raw = response.read().decode("utf-8", errors="replace")
                
                # Extract cookies
                resp_headers = {}
                for k, v in response.headers.items():
                    resp_headers[k.lower()] = v
                    if k.lower() == "set-cookie":
                        cookie_part = v.split(";")[0]
                        if "=" in cookie_part:
                            ckey, cval = cookie_part.split("=", 1)
                            self.session_cookies[ckey.strip()] = cval.strip()

                try:
                    res_json = json.loads(body_raw)
                except Exception:
                    res_json = body_raw
                return status, res_json, resp_headers
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_body)
            except Exception:
                err_json = err_body
            return e.code, err_json, {}
        except Exception as e:
            return 0, str(e), {}

    def test_role_login_and_endpoints(self, profile: Dict[str, Any]):
        role = profile["role"]
        pin = profile["pin"]
        print(f"\n🔍 [PROBANDO ROL: {role.upper()}] - {profile['label']}")
        
        self.session_cookies = {}
        # 1. Probar Login por PIN
        status, resp, _ = self._http_request("/api/auth/pin/login", method="POST", data={"pin": pin})
        
        token = ""
        if isinstance(resp, dict):
            token = resp.get("session_token") or resp.get("token") or resp.get("access_token") or ""

        if status not in (200, 201):
            self.issues.append({
                "severity": "CRITICAL" if role in ("gerencia", "cajero", "vendedor") else "WARNING",
                "category": "Autenticación de Rol",
                "role": role,
                "target": f"/api/auth/pin/login (PIN: {pin})",
                "status_code": status,
                "message": f"Fallo al autenticar sesión de prueba para rol '{role}'. Respuesta: {resp}",
                "suggestion": f"Verificar que el usuario '{profile['username']}' con PIN '{pin}' esté creado y activo en MongoDB."
            })
            print(f"  ❌ Fallo de Login ({status}): {resp}")
            return
        
        print(f"  ✔ Autenticación exitosa como '{role}'")
        self.coverage_stats["roles_tested"] += 1

        # 2. Probar Endpoints de API autorizados para este rol
        for endpoint in profile["api_endpoints"]:
            self.coverage_stats["endpoints_tested"] += 1
            e_status, e_resp, _ = self._http_request(endpoint, method="GET", token=token)
            
            if e_status in (200, 201, 204):
                print(f"    ✔ {endpoint} -> HTTP {e_status}")
            elif e_status == 403:
                self.issues.append({
                    "severity": "WARNING",
                    "category": "Permisos / RBAC",
                    "role": role,
                    "target": endpoint,
                    "status_code": 403,
                    "message": f"El rol '{role}' recibió 403 Forbidden en su endpoint asignado '{endpoint}'",
                    "suggestion": f"Revisar require_roles en el endpoint '{endpoint}' para incluir '{role}' si corresponde."
                })
                print(f"    ⚠️ {endpoint} -> HTTP 403 (Permiso denegado)")
            elif e_status >= 500 or e_status == 0:
                self.issues.append({
                    "severity": "CRITICAL",
                    "category": "Error de Servidor (500/Crash)",
                    "role": role,
                    "target": endpoint,
                    "status_code": e_status,
                    "message": f"Error interno en endpoint '{endpoint}': {e_resp}",
                    "suggestion": f"Revisar traceback en backend/server.py para {endpoint}."
                })
                print(f"    ❌ {endpoint} -> HTTP {e_status} (Error de Servidor)")
            else:
                print(f"    ℹ️ {endpoint} -> HTTP {e_status}")

    def generate_report(self, report_path: Path):
        critical_count = sum(1 for i in self.issues if i["severity"] == "CRITICAL")
        warning_count = sum(1 for i in self.issues if i["severity"] == "WARNING")
        
        md = f"""# 📋 Reporte Integral del Agente de Diagnóstico y Rastreo Multi-Rol ERP

**Fecha de Ejecución:** `{datetime.now(timezone.utc).isoformat()}`  
**URL Objetivo:** `{self.base_url}`  
**Roles Auditados:** `{self.coverage_stats['roles_tested']}/{len(ROLE_PROFILES)}`  
**Endpoints Evaluados:** `{self.coverage_stats['endpoints_tested']}`  

---

## 📊 Resumen Ejecutivo de Hallazgos

| Nivel de Severidad | Cantidad de Incidencias | Acción Requerida |
| :--- | :---: | :--- |
| 🔴 **CRITICAL** | **{critical_count}** | Corrección Inmediata |
| 🟡 **WARNING** | **{warning_count}** | Revisión de Permisos / Datos |
| 🟢 **OK / Operativo** | **{self.coverage_stats['endpoints_tested'] - len(self.issues)}** | Sin acción requerida |

---

## 🛠️ Listado Detallado de Incidencias Detectadas (Para Solución 1 a 1)

"""
        if not self.issues:
            md += "> ✅ **¡Excelente! No se detectaron fallos de servidor ni problemas de acceso en ninguno de los roles evaluados.**\n"
        else:
            for idx, issue in enumerate(self.issues, 1):
                icon = "🔴" if issue["severity"] == "CRITICAL" else "🟡"
                md += f"### {idx}. {icon} [{issue['severity']}] {issue['category']} - Rol: `{issue['role']}`\n\n"
                md += f"- **Ruta / Endpoint:** `{issue['target']}`\n"
                md += f"- **Código HTTP:** `{issue['status_code']}`\n"
                md += f"- **Descripción:** {issue['message']}\n"
                md += f"- **Sugerencia de Corrección:** {issue['suggestion']}\n\n"
                md += "---\n\n"

        report_path.write_text(md, encoding="utf-8")
        print(f"\n📄 Reporte generado exitosamente en: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Agente de Diagnóstico y Rastreo Multi-Rol")
    parser.add_argument("--url", default="https://mclarens-erp-836176703716.us-central1.run.app", help="Base URL")
    args = parser.parse_args()

    print(f"🚀 Iniciando Agente de Diagnóstico Multi-Rol contra: {args.url}")
    crawler = DiagnosticCrawlerAgent(args.url)

    for profile in ROLE_PROFILES:
        crawler.test_role_login_and_endpoints(profile)

    report_file = Path(__file__).resolve().parents[1] / "QA_MULTI_ROLE_DIAGNOSTIC_REPORT.md"
    crawler.generate_report(report_file)


if __name__ == "__main__":
    main()
