import sys
import traceback
import hashlib

def get_route_metrics(app):
    routes = []
    # Flask routes
    for rule in app.url_map.iter_rules():
        routes.append(rule.rule)
    sorted_routes = sorted(list(set(routes)))
    route_count = len(sorted_routes)
    route_hash = hashlib.sha256("\n".join(sorted_routes).encode('utf-8')).hexdigest()
    return route_count, route_hash

try:
    from backend.server import app
    count, r_hash = get_route_metrics(app)
    print("BACKEND_IMPORT_OK")
    print(f"ROUTE_COUNT={count}")
    print(f"ROUTE_HASH={r_hash}")
    sys.exit(0)
except Exception as e:
    print("BACKEND_IMPORT_FAIL")
    print(f"ERROR={repr(e)}")
    traceback.print_exc()
    sys.exit(2)
