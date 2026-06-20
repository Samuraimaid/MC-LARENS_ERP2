import hashlib, sys, traceback
try:
    from backend.server import app
    routes = sorted(set([r.path for r in app.routes if hasattr(r, "path")]))
    print("BACKEND_IMPORT_OK")
    print(f"ROUTE_COUNT={len(routes)}")
    print(f"ROUTE_HASH={hashlib.sha256(chr(10).join(routes).encode()).hexdigest()}")
    sys.exit(0)
except Exception as e:
    print("BACKEND_IMPORT_FAIL")
    print(f"ERROR={repr(e)}")
    traceback.print_exc()
    sys.exit(2)
