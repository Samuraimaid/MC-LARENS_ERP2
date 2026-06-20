# PHASE 5.2C - REQUIREMENTS LAYER PROPOSAL

## Objective
Design a layered requirements model for deterministic installs and cleaner ownership boundaries.

## Proposed structure
backend/requirements/
1. runtime.in
2. optional.in
3. exports.in
4. scheduler.in
5. dev.in
6. test.in

## Proposed package allocation

### runtime.in
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

### optional.in
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

### exports.in
- openpyxl
- pandas
- reportlab

### scheduler.in
- apscheduler

### dev.in
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

### test.in
- iniconfig
- pluggy
- pytest

## Unassigned set requiring deeper ownership resolution
Current unassigned dependencies: 86.
Reference source: temporary_cleanup_validation/phase5_2c/requirements_layer_proposal.json.

## Validation of proposal consistency
1. Layer overlaps: 0.
2. Union of layers equals requirements.txt: true.
3. Missing from layers: none.
4. Extra in layers: none.

## Implementation boundary
1. This phase only proposes layers.
2. No file migration or requirements split executed yet.
3. No runtime, import, or Docker changes made.
