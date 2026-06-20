import json
import os
import sys
import hashlib
from fastapi.routing import APIRoute

def get_routes():
    try:
        # Push roots to path
        sys.path.insert(0, os.getcwd())
        from backend.main import app
        routes = []
        for route in app.routes:
            if isinstance(route, APIRoute):
                routes.append(route.path)
        routes.sort()
        route_str = ",".join(routes)
        route_hash = hashlib.sha256(route_str.encode()).hexdigest()
        
        core_req = ["/api/auth/me", "/api/auth/logout", "/api/auth/session/lock", "/api/auth/session/unlock", 
                    "/api/drafts/{flow}", "/api/sales", "/api/quotations", "/api/caja/facturas", "/api/approvals"]
        export_req = ["/api/backup/excel", "/api/backup/excel/import", "/api/print/invoice-pdf/{sale_id}", 
                      "/api/caja/cierre/{session_id}/excel", "/inventory/movements/export", "/hr/attendance/reports/biweekly/export"]
        
        missing_core = [p for p in core_req if p not in routes]
        missing_export = [p for p in export_req if p not in routes]
        
        return {
            "import_ok": True,
            "route_count": len(routes),
            "route_hash": route_hash,
            "missing_core": missing_core,
            "missing_export": missing_export,
            "error": None
        }
    except Exception as e:
        return {
            "import_ok": False,
            "route_count": 0,
            "route_hash": None,
            "missing_core": [],
            "missing_export": [],
            "error": str(e)
        }

if __name__ == "__main__":
    print(json.dumps(get_routes()))
