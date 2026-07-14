"""Resolve cloud credentials for the server appliance dashboard."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

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


def resolve_terabox_settings() -> Dict[str, str]:
    root = cloud_config_value("TERABOX_ROOT_FOLDER") or "/MCLarensERP"
    remote = cloud_config_value("TERABOX_REMOTE_FOLDER") or "/MCLarensERP/cold-backups"
    if root and not str(root).startswith("/"):
        root = f"/{root}"
    if remote and not str(remote).startswith("/"):
        remote = f"/{remote}"
    return {
        "username": cloud_config_value("TERABOX_USERNAME"),
        "root_folder": root,
        "remote_folder": remote,
        "share_url": cloud_config_value("TERABOX_SHARE_URL"),
    }


def resolve_terabox_session_cookies() -> Dict[str, str]:
    return {
        "jstoken": cloud_config_value("TERABOX_JSTOKEN"),
        "csrfToken": cloud_config_value("TERABOX_CSRFTOKEN", "TERABOX_CSRF_TOKEN"),
        "browserid": cloud_config_value("TERABOX_BROWSERID"),
        "ndus": cloud_config_value("TERABOX_NDUS"),
        "lang": cloud_config_value("TERABOX_LANG") or "en",
    }


def has_terabox_session_cookies() -> bool:
    cookies = resolve_terabox_session_cookies()
    return bool(
        cookies.get("jstoken")
        and cookies.get("csrfToken")
        and cookies.get("browserid")
        and cookies.get("ndus")
    )


def persist_terabox_session_cookies(cookie_map: Dict[str, Any]) -> None:
    mapping = {
        "TERABOX_JSTOKEN": cookie_map.get("jstoken"),
        "TERABOX_CSRFTOKEN": cookie_map.get("csrfToken"),
        "TERABOX_BROWSERID": cookie_map.get("browserid"),
        "TERABOX_NDUS": cookie_map.get("ndus"),
        "TERABOX_LANG": cookie_map.get("lang"),
    }
    updates = {key: str(value).strip() for key, value in mapping.items() if str(value or "").strip()}
    if updates:
        write_appliance_cloud_values(updates)


def _mask_username(value: str) -> str:
    raw = str(value or "").strip()
    if "@" not in raw:
        return raw[:3] + "***" if len(raw) > 3 else "***"
    local, domain = raw.split("@", 1)
    masked_local = (local[:2] + "***") if local else "***"
    return f"{masked_local}@{domain}"


def get_terabox_credentials_public() -> Dict[str, Any]:
    username, _password = resolve_terabox_credentials()
    settings = resolve_terabox_settings()
    return {
        "configured": bool(username),
        "username_masked": _mask_username(username) if username else "",
        "root_folder": settings.get("root_folder"),
        "remote_folder": settings.get("remote_folder"),
        "share_url": settings.get("share_url"),
        "session_configured": has_terabox_session_cookies(),
        "session_fields": {
            "jstoken": bool(resolve_terabox_session_cookies().get("jstoken")),
            "ndus": bool(resolve_terabox_session_cookies().get("ndus")),
            "csrfToken": bool(resolve_terabox_session_cookies().get("csrfToken")),
            "browserid": bool(resolve_terabox_session_cookies().get("browserid")),
        },
    }


def _primary_config_path() -> Path:
    custom = str(os.environ.get("APPLIANCE_CLOUD_ENV_FILE") or "").strip()
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parents[2] / "data" / "appliance_cloud.env"


def clear_appliance_cloud_cache() -> None:
    global _CONFIG_CACHE
    _CONFIG_CACHE = None


def write_appliance_cloud_values(updates: Dict[str, str]) -> Path:
    path = _primary_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = _parse_env_file(path) if path.exists() else {}
    merged = {**existing, **{k: str(v).strip() for k, v in updates.items() if str(v).strip()}}
    lines = [
        "# Credenciales cloud — NO commitear (gitignored)",
    ]
    for key in sorted(merged.keys()):
        lines.append(f"{key}={merged[key]}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    clear_appliance_cloud_cache()
    try:
        from backend.services.terabox_sdk import clear_terabox_cache

        clear_terabox_cache()
    except Exception:
        pass
    for key, value in merged.items():
        os.environ[key] = value
    return path


def is_cloud_configured() -> Dict[str, bool]:
    return {
        "mongodb_atlas": bool(resolve_central_mongo_uri()),
        "cloudflare": bool(resolve_cloudflare_tunnel_token()),
        "terabox": bool(resolve_terabox_credentials()[0] and resolve_terabox_credentials()[1]),
    }