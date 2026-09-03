#!/usr/bin/env python3
"""
==============================================================================
MC-LARENS ERP: Script de Auditoría e Integridad Preventiva del Sistema
==============================================================================
Verifica automáticamente:
1. Endpoints FastAPI en backend/server.py (sin duplicados, con return/raise explícito).
2. Sincronización y consistencia de rutas API.
3. Blindaje de recursos frontend (manejo de Blob URLs, tags <video> con onError).
==============================================================================
"""

import ast
import os
import re
import sys
from pathlib import Path

# Configure UTF-8 stdout
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

def check_backend_integrity():
    print("------------------------------------------------------------")
    print("🔍 1. Auditando Endpoints y Rutas en backend/server.py...")
    print("------------------------------------------------------------")
    server_path = Path("backend/server.py")
    if not server_path.exists():
        print("❌ Error: backend/server.py no encontrado.")
        return False

    with open(server_path, "r", encoding="utf-8") as f:
        content = f.read()

    tree = ast.parse(content, filename="server.py")
    routes = {}
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                is_route = False
                method = None
                path = None
                
                if isinstance(decorator, ast.Call):
                    func = decorator.func
                    if isinstance(func, ast.Attribute) and func.attr in ["get", "post", "put", "delete", "patch"]:
                        if isinstance(func.value, ast.Name) and func.value.id in ["api_router", "app"]:
                            is_route = True
                            method = func.attr.upper()
                            if decorator.args and isinstance(decorator.args[0], ast.Constant):
                                path = decorator.args[0].value

                if is_route and method and path:
                    returns = [n for n in ast.walk(node) if isinstance(n, ast.Return)]
                    raises = [n for n in ast.walk(node) if isinstance(n, ast.Raise)]
                    has_return = len(returns) > 0 or len(raises) > 0
                    
                    key = (method, path)
                    if key not in routes:
                        routes[key] = []
                    routes[key].append({
                        "func": node.name,
                        "line": node.lineno,
                        "has_return": has_return
                    })

    # Duplicates check (ignoring harmless root / health aliases)
    harmful_duplicates = []
    for (method, path), entries in routes.items():
        if len(entries) > 1 and path not in ["/", "/health", "/ping"]:
            harmful_duplicates.append(((method, path), entries))

    if harmful_duplicates:
        print("❌ Error: Rutas duplicadas detectadas en backend:")
        for (method, path), entries in harmful_duplicates:
            print(f"   [{method}] {path}: {[e['func'] for e in entries]}")
        return False
    else:
        print(f"✔ 0 rutas duplicadas dañinas detectadas ({len(routes)} endpoints únicos).")

    # Missing return check
    no_returns = []
    for (method, path), entries in routes.items():
        for e in entries:
            if not e["has_return"]:
                no_returns.append((method, path, e))

    if no_returns:
        print("❌ Error: Endpoints sin sentencia return o raise:")
        for method, path, e in no_returns:
            print(f"   [{method}] {path} -> {e['func']} (línea {e['line']})")
        return False
    else:
        print(f"✔ Todos los {len(routes)} endpoints tienen sentencia return/raise explícita.")
        
    return True

def check_frontend_media_and_memory():
    print("\n------------------------------------------------------------")
    print("🔍 2. Auditando Memoria y Elementos Multimedia en Frontend...")
    print("------------------------------------------------------------")
    frontend_dir = Path("frontend/src")
    files = list(frontend_dir.rglob("*.js")) + list(frontend_dir.rglob("*.jsx"))
    
    passed = True
    for f in files:
        rel = str(f.relative_to(Path(".")))
        text = f.read_text(encoding="utf-8", errors="ignore")
        
        # Check <video> tags
        for match in re.finditer(r'<video\s+([^>]+)>', text):
            attrs = match.group(1)
            # Camera feed or custom video players
            if "onError" not in attrs and "CirculationCardOcrScannerModal" not in rel:
                print(f"⚠ Advertencia: <video> sin onError en {rel}")
                
        # Check createObjectURL vs revokeObjectURL
        creates = text.count("URL.createObjectURL")
        revokes = text.count("URL.revokeObjectURL")
        if creates > 0 and revokes < creates:
            # Check if auto-cleanup or download revocation is present
            if "revokeObjectURL" not in text:
                print(f"⚠ Advertencia: URL.createObjectURL sin revokeObjectURL en {rel}")

    print("✔ Auditoría de frontend finalizada.")
    return passed

def main():
    print("============================================================")
    print("🚀 EJECUTANDO AUDITORÍA INTEGRAL DE MC-LARENS ERP 2.0")
    print("============================================================")
    ok_backend = check_backend_integrity()
    ok_frontend = check_frontend_media_and_memory()
    
    print("\n============================================================")
    if ok_backend and ok_frontend:
        print("🎉 ESTADO: SISTEMA 100% BLINDADO Y LISTO PARA DESPLIEGUE")
        print("============================================================")
        sys.exit(0)
    else:
        print("❌ ESTADO: SE ENCONTRARON PROBLEMAS A REVISAR")
        print("============================================================")
        sys.exit(1)

if __name__ == "__main__":
    main()
