# DOMAIN_EXTRACTION_CHECKLIST

## PRE-EXTRACTION
- boundary mapped
- startup traced
- contracts identified
- dependencies identified
- risky endpoints listed
- baseline route hash captured
- baseline route count captured
- rollback cut line defined

## IMPLEMENTATION
- wrappers preserved
- delegation incremental
- no route changes
- no payload changes
- no response changes
- no startup import regressions
- lazy dependencies preserved where applicable
- no destructive file moves
- no global rewrites

## POST-EXTRACTION
- route parity
- route hash parity
- Docker parity
- clean-room parity
- frontend parity
- smoke validation
- rollback validation
- no circular imports
- startup regression check

## REQUIRED EVIDENCE FILES
- full-stack probe output
- clean-room probe output
- parity summary output
- dependency smoke output
- domain runtime smoke output
- Docker validation output
- frontend drift output
- optional HTTP surface probe output

## GO/NO-GO GATE
- GO only if all parity checks pass.
- NO-GO if any contract drift is detected.
- NO-GO if rollback path is not proven executable.
