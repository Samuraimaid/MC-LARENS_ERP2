# PHASE 5.2C - SAFE DEPENDENCY ISOLATION CANDIDATES

## Objective
Classify dependencies by cleanup safety without removing or moving anything yet.

## Classification buckets

### Core Critical (do not touch yet)
- fastapi
- starlette
- uvicorn
- pydantic
- motor
- pymongo
- bcrypt
- passlib
- python-jose
- pyjwt
- python-dotenv
- python-multipart
- requests
- httpx
- pytz
- sendgrid

### Safe to Isolate (optional layer candidates)
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
- emergentintegrations (import-level candidate, currently optional pattern)

### Safe to Move to Dev
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

### Safe to Move to Test
- pytest
- iniconfig
- pluggy

### Safe to isolate as export/report domain
- pandas
- openpyxl
- reportlab

### Safe to isolate as scheduler domain
- apscheduler

### Unknown Ownership (investigation required before move)
Total unknown set: 86 dependencies.
Reference list: DEPENDENCY_OWNERSHIP_MATRIX.md and temporary_cleanup_validation/phase5_2c/requirements_layer_proposal.json.

## Safety constraints respected
1. No dependency removed.
2. No import changed.
3. No runtime path changed.
4. No Docker changes applied.
