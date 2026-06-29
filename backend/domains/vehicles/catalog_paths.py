"""Resolve vehicle catalog JSON path across dev monorepo and Docker runtime."""
from __future__ import annotations

from pathlib import Path

_PKG_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]


def resolve_catalog_path() -> Path:
    candidates = [
        _REPO_ROOT / "frontend" / "src" / "data" / "vehicleCatalog.json",
        _PKG_ROOT / "data" / "vehicleCatalog.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def resolve_backend_data_dir() -> Path:
    return _PKG_ROOT / "data"