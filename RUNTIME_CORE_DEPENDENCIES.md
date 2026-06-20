# PHASE 5.2C - RUNTIME CORE DEPENDENCIES

## Objective
Define runtime core dependencies required for backend startup and critical business flows.

## Core runtime set
1. fastapi
2. starlette
3. uvicorn
4. pydantic
5. motor
6. pymongo
7. bcrypt
8. passlib
9. python-jose
10. pyjwt
11. python-dotenv
12. python-multipart
13. requests
14. httpx
15. pytz
16. sendgrid

## Why these are core
1. Startup path enters through backend/main.py -> backend/server.py.
2. backend/server.py imports fastapi, bcrypt, motor, pymongo, pydantic, httpx at module load.
3. Auth/session and PIN flows rely on bcrypt and token stack.
4. Mongo persistence relies on motor and pymongo.
5. Core API behavior depends on fastapi and starlette.

## Contract-critical domains covered
1. Auth and Session
2. Drafts
3. Sales
4. Quotations
5. Cashier
6. Approvals

## Startup criticality notes
1. bcrypt is hard startup import in backend/server.py.
2. fastapi is imported across API and middleware modules.
3. Any breakage in this set affects startup or critical runtime contracts.

## Exclusions from runtime core
1. Optional integrations are excluded.
2. Export/report stacks are excluded by ownership intent.
3. Dev and test tooling are excluded.

## Status
Classification only. No runtime modifications performed.
