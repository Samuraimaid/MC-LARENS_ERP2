"""Resolve cloud credentials for the server appliance dashboard."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Optional

_CONFIG_CACHE: Dict[str, str] | None = None


def _parse_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return values
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            values[key] = val
    return values


def _config_file_candidates() -> list[Path]:
    custom = str(os.environ.get("APPLIANCE_CLOUD_ENV_FILE") or "").strip()
    paths: list[Path] = []
    if custom:
        paths.append(Path(custom))
    backend_data = Path(__file__).resolve().parents[2] / "data"
    paths.extend([
        backend_data / "appliance_cloud.env",
        backend_data / "central.env",
        Path("/app/backend/data/appliance_cloud.env"),
        Path("/app/backend/data/central.env"),
    ])
    if os.name == "nt":
        program_data = os.environ.get("ProgramData", r"C:\ProgramData")
        paths.append(Path(program_data) / "MCLarensERP" / "central.env")
        paths.append(Path(__file__).resolve().parents[2] / "scripts" / ".mclarens_central.env")
    repo_env = Path(__file__).resolve().parents[3] / ".env"
    paths.append(repo_env)
    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def load_appliance_cloud_config() -> Dict[str, str]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return dict(_CONFIG_CACHE)

    merged: Dict[str, str] = {}
    for path in _config_file_candidates():
        if not path.exists():
            continue
        merged.update(_parse_env_file(path))

    _CONFIG_CACHE = merged
    return dict(merged)


def cloud_config_value(*keys: str) -> str:
    for key in keys:
        env_val = str(os.environ.get(key) or "").strip()
        if env_val:
            return env_val
    file_vals = load_appliance_cloud_config()
    for key in keys:
        val = str(file_vals.get(key) or "").strip()
        if val:
            return val
    return ""


def resolve_central_mongo_uri() -> Optional[str]:
    uri = cloud_config_value("MONGODB_CENTRAL_URI", "MCLARENS_CENTRAL_URI")
    return uri or None


def resolve_cloudflare_tunnel_token() -> str:
    return cloud_config_value("CLOUDFLARE_TUNNEL_TOKEN", "TUNNEL_TOKEN")


def resolve_terabox_credentials() -> tuple[str, str]:
    username = cloud_config_value("TERABOX_USERNAME")
    password = cloud_config_value("TERABOX_PASSWORD")
    return username, password


def is_cloud_configured() -> Dict[str, bool]:
    return {
        "mongodb_atlas": bool(resolve_central_mongo_uri()),
        "cloudflare": bool(resolve_cloudflare_tunnel_token()),
        "terabox": bool(resolve_terabox_credentials()[0] and resolve_terabox_credentials()[1]),
    }