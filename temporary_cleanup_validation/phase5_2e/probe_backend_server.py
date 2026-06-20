import json
import hashlib
import sys
import os

def probe():
    result = {
        "import_ok": False,
        "route_count": 0,
        "route_hash": "",
        "missing_core": [],
        "missing_export": [],
        "error": None
    }
    
    core_required = [
        "/api/auth/me", "/api/auth/logout", "/api/auth/session/lock", "/api/auth/session/unlock",
        "/api/drafts/{flow}", "/api/sales", "/api/quotations", "/api/caja/facturas", "/api/approvals"
    ]
    export_required = [
        "/api/backup/excel", "/api/backup/excel/import", "/api/print/invoice-pdf/{sale_id}",
        "/api/caja/cierre/{session_id}/excel", "/api/inventory/movements/export", "/api/hr/attendance/reports/biweekly/export"
    ]

    try:
        from backend.server import app
        result["import_ok"] = True
        
        # Extract unique paths from FastAPI app
        paths = sorted(list(set(route.path for route in app.routes)))
        result["route_count"] = len(paths)
        
        # Compute SHA256 hash
        paths_str = "\n".join(paths)
        result["route_hash"] = hashlib.sha256(paths_str.encode('utf-8')).hexdigest()
        
        # Check missing routes
        result["missing_core"] = [p for p in core_required if p not in paths]
        result["missing_export"] = [p for p in export_required if p not in paths]
        
    except Exception as e:
        result["error"] = str(e)
        import traceback
        result["traceback"] = traceback.format_exc()
        
    return result

if __name__ == "__main__":
    data = probe()
    print(json.dumps(data, indent=2))
