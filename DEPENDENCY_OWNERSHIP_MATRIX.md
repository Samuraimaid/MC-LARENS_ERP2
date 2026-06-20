# PHASE 5.2C - DEPENDENCY OWNERSHIP MATRIX

## Scope
Formal ownership classification for all dependencies declared in backend/requirements.txt.

## Evidence base
- temporary_cleanup_validation/phase5_2c/dependency_ownership_trace.json
- temporary_cleanup_validation/phase5_2c/requirements_layer_proposal.json
- temporary_cleanup_validation/phase5_2c/layer_consistency_check.json

## Consistency checks
1. Total packages in backend/requirements.txt: 130.
2. Total unique packages classified: 130.
3. Layer overlaps detected: 0.
4. Coverage vs requirements.txt: exact match.

## Ownership categories and package mapping

### Runtime Core (16)
- bcrypt
- fastapi
- httpx
- motor
- passlib
- pydantic
- pyjwt
- pymongo
- python-dotenv
- python-jose
- python-multipart
- pytz
- requests
- sendgrid
- starlette
- uvicorn

### Optional Integrations (11)
- boto3
- botocore
- google-ai-generativelanguage
- google-genai
- google-generativeai
- huggingface-hub
- litellm
- openai
- stripe
- tiktoken
- tokenizers

### Export and Reporting (3)
- openpyxl
- pandas
- reportlab

### Background and Schedulers (1)
- apscheduler

### Dev Tooling (10)
- black
- flake8
- isort
- jq
- mccabe
- mypy
- mypy-extensions
- pre-commit
- pycodestyle
- pyflakes

### Test Tooling (3)
- iniconfig
- pluggy
- pytest

### Unknown Ownership (86)
- aiohappyeyeballs
- aiohttp
- aiosignal
- annotated-types
- anyio
- attrs
- certifi
- cffi
- charset-normalizer
- click
- cryptography
- distro
- dnspython
- ecdsa
- email-validator
- fastuuid
- filelock
- frozenlist
- fsspec
- google-api-core
- google-api-python-client
- google-auth
- google-auth-httplib2
- googleapis-common-protos
- grpcio
- grpcio-status
- h11
- hf-xet
- httpcore
- httplib2
- idna
- importlib-metadata
- jinja2
- jiter
- jmespath
- jsonschema
- jsonschema-specifications
- librt
- markdown-it-py
- markupsafe
- mdurl
- multidict
- numpy
- oauthlib
- packaging
- pathspec
- pillow
- platformdirs
- propcache
- proto-plus
- protobuf
- pyasn1
- pyasn1-modules
- pycparser
- pydantic-core
- pygments
- pyparsing
- python-dateutil
- python-http-client
- pytokens
- pyyaml
- referencing
- regex
- requests-oauthlib
- rich
- rpds-py
- rsa
- s3transfer
- s5cmd
- shellingham
- six
- sniffio
- tenacity
- tqdm
- typer
- typer-slim
- typing-extensions
- typing-inspection
- tzdata
- uritemplate
- urllib3
- watchfiles
- websockets
- werkzeug
- yarl
- zipp

## Startup-critical ownership highlights
1. fastapi and bcrypt are startup-critical because backend/server.py imports them at module load.
2. runtime core startup path is anchored by backend/main.py importing backend/server.py.
3. export and reporting packages are currently imported in startup path, even though functional ownership is export/report scope.

## Notes
1. This matrix is a classification baseline only.
2. No dependency removals or runtime modifications were performed in this phase.
