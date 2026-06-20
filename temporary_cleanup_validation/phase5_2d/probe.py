try:
    import sys
    import os
    sys.path.append(os.getcwd())
    from backend.server import app
    print('backend-import-ok')
    routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            routes.append(route.path)
    print(f"ROUTE_COUNT:{len(routes)}")
    print("ROUTES_LIST:" + ",".join(routes))
except Exception as e:
    print(f"PROBE_ERROR:{e}")
