#!/usr/bin/env python3
"""Normalize vehicle catalog lines so each engine option is one row.

Input format example:
Model (Chassis) [Years] - EngineA [G] / EngineB [G]

Output:
- JSON catalog for frontend consumption.
- TXT file with one line per model+generation+engine.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

BRAND_RE = re.compile(r"^GU[IÍ]A MAESTRA DE GENERACIONES\s+(.+?)\s*\(")
ENGINE_SPLIT_RE = re.compile(r"\s+/\s+")
FUEL_RE = re.compile(r"\[([A-Z](?:/[A-Z])?)\]\s*$")

SKIP_KEYWORDS = (
    "motocic",
    "moto ",
    "scooter",
    "bike",
    "concept",
    "prototipo",
)

TOYOTA_1KD_FTV_MANUAL_ENTRIES: tuple[tuple[str, str], ...] = (
    ("Hilux (N140/N150/N160/N170) [1997-2005]", "3.0L 1KD-FTV [D]"),
    ("Hilux (AN10/20) [2004-2015]", "3.0L 1KD-FTV [D]"),
    ("Hilux Vigo (nombre regional) [2004-2015]", "3.0L 1KD-FTV [D]"),
    ("Fortuner (AN50) [2004-2015]", "3.0L 1KD-FTV [D]"),
    ("Land Cruiser Prado (J120) [2002-2009]", "3.0L 1KD-FTV [D]"),
    ("Land Cruiser Prado (J150) [2009-2015]", "3.0L 1KD-FTV [D]"),
    ("Hiace (H100 - ultimas versiones) [~2000-2004]", "3.0L 1KD-FTV [D]"),
    ("Hiace (H200) [2004-Presente]", "3.0L 1KD-FTV [D]"),
    ("Toyota Dyna [2000-2010+]", "3.0L 1KD-FTV [D]"),
    ("Toyota ToyoAce [2000-2010+]", "3.0L 1KD-FTV [D]"),
    ("Innova (AN40) [2004-2015]", "3.0L 1KD-FTV [D]"),
    ("Kijang Innova (Asia) [2004-2015]", "3.0L 1KD-FTV [D]"),
)


@dataclass
class CatalogRow:
    id: str
    brand: str
    descriptor: str
    model: str
    engine: str
    fuel: str
    label: str


def should_skip_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if s.startswith("==="):
        return True
    if s.startswith("FORMATO:"):
        return True
    if s.startswith("---"):
        return True
    if s.startswith("FIN DE GU"):
        return True
    if s.startswith("FIN BLOQUE"):
        return True
    if s.startswith("FIN TOTAL"):
        return True
    if s.startswith("NOTA:"):
        return True
    if s.startswith("(") and "No aplica" in s:
        return True
    if s.startswith("/*"):
        return True
    if s.startswith("- Presencia"):
        return True
    return False


def is_non_vehicle_row(descriptor: str, engine: str) -> bool:
    joined = f"{descriptor} {engine}".lower()
    return any(k in joined for k in SKIP_KEYWORDS)


def extract_model(descriptor: str) -> str:
    # Keep only model name before first chassis/year token.
    model = descriptor.split("(", 1)[0].strip()
    return model or descriptor.strip()


def infer_default_fuel(engines: Iterable[str]) -> str:
    for candidate in reversed(list(engines)):
        m = FUEL_RE.search(candidate)
        if m:
            return m.group(1)
    return ""


def normalize_engine(engine: str, default_fuel: str) -> tuple[str, str]:
    e = engine.strip().rstrip(".")
    m = FUEL_RE.search(e)
    if m:
        return e, m.group(1)
    if default_fuel:
        return f"{e} [{default_fuel}]", default_fuel
    return e, ""


def parse_catalog(source_path: Path) -> list[CatalogRow]:
    rows: list[CatalogRow] = []
    current_brand = ""

    for raw in source_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()

        brand_match = BRAND_RE.match(line)
        if brand_match:
            current_brand = brand_match.group(1).strip().upper()
            continue

        if should_skip_line(line):
            continue
        if " - " not in line:
            continue
        if not current_brand:
            continue

        descriptor, engines_chunk = line.split(" - ", 1)
        descriptor = descriptor.strip()
        if "No aplica" in descriptor:
            continue

        engine_candidates = [p.strip() for p in ENGINE_SPLIT_RE.split(engines_chunk) if p.strip()]
        if not engine_candidates:
            continue

        default_fuel = infer_default_fuel(engine_candidates)
        model = extract_model(descriptor)

        for idx, raw_engine in enumerate(engine_candidates, start=1):
            engine, fuel = normalize_engine(raw_engine, default_fuel)
            if is_non_vehicle_row(descriptor, engine):
                continue
            label = f"{descriptor} - {engine}"
            row_id = f"{current_brand}::{descriptor}::{idx}"
            rows.append(
                CatalogRow(
                    id=row_id,
                    brand=current_brand,
                    descriptor=descriptor,
                    model=model,
                    engine=engine,
                    fuel=fuel,
                    label=label,
                )
            )

    rows = normalize_toyota_1kd_rows(rows)
    return append_manual_toyota_1kd_entries(rows)


def normalize_toyota_1kd_rows(rows: list[CatalogRow]) -> list[CatalogRow]:
    normalized: list[CatalogRow] = []
    dedupe_keys: set[tuple[str, str]] = set()
    fixed_idx = 0

    for row in rows:
        label = row.label or ""
        descriptor = row.descriptor or ""

        # Ignore block titles accidentally parsed as catalog rows.
        if descriptor.upper().startswith("TOYOTA - MOTORES 1KD-FTV"):
            continue
        if descriptor.strip().upper() == "TOYOTA" and (row.engine or "").strip().upper().startswith("MOTORES 1KD-FTV"):
            continue

        current = row
        if "1KD-FTV" in label.upper():
            fixed_idx += 1
            current = CatalogRow(
                id=f"TOYOTA::FIXED_1KD::{fixed_idx}",
                brand="TOYOTA",
                descriptor=descriptor,
                model=extract_model(descriptor),
                engine=row.engine,
                fuel=row.fuel or "D",
                label=label,
            )

        key = (current.brand, normalize_label_for_dedupe(current.label))
        if key in dedupe_keys:
            continue
        dedupe_keys.add(key)
        normalized.append(current)

    return normalized


def normalize_label_for_dedupe(value: str) -> str:
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def append_manual_toyota_1kd_entries(rows: list[CatalogRow]) -> list[CatalogRow]:
    existing_labels = {normalize_label_for_dedupe(r.label) for r in rows}

    for idx, (descriptor, engine) in enumerate(TOYOTA_1KD_FTV_MANUAL_ENTRIES, start=1):
        label = f"{descriptor} - {engine}"
        if normalize_label_for_dedupe(label) in existing_labels:
            continue

        model = extract_model(descriptor)
        rows.append(
            CatalogRow(
                id=f"TOYOTA::MANUAL_1KD::{idx}",
                brand="TOYOTA",
                descriptor=descriptor,
                model=model,
                engine=engine,
                fuel="D",
                label=label,
            )
        )
        existing_labels.add(normalize_label_for_dedupe(label))

    return rows


def write_outputs(rows: list[CatalogRow], source_path: Path, json_path: Path, txt_path: Path) -> None:
    brands = sorted({r.brand for r in rows})
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_file": str(source_path),
        "total_rows": len(rows),
        "total_brands": len(brands),
        "brands": brands,
        "entries": [asdict(r) for r in rows],
    }

    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")

    grouped: dict[str, list[CatalogRow]] = {}
    for row in rows:
        grouped.setdefault(row.brand, []).append(row)

    lines: list[str] = []
    for brand in sorted(grouped):
        lines.append("=" * 80)
        lines.append(f"GUIA NORMALIZADA {brand}")
        lines.append("=" * 80)
        for row in grouped[brand]:
            lines.append(row.label)
        lines.append("")

    txt_path.parent.mkdir(parents=True, exist_ok=True)
    txt_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize vehicle catalog rows")
    parser.add_argument(
        "--source",
        default=r"c:\\Users\\Administrator\\Desktop\\marcas de vehiculo.txt",
        help="Path to source TXT catalog",
    )
    parser.add_argument(
        "--json-out",
        default=r"d:\\MC-LARENS_ERP2\\frontend\\src\\data\\vehicleCatalog.json",
        help="JSON output path",
    )
    parser.add_argument(
        "--txt-out",
        default=r"d:\\MC-LARENS_ERP2\\frontend\\src\\data\\vehicleCatalogNormalized.txt",
        help="TXT output path",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    rows = parse_catalog(source_path)
    write_outputs(rows, source_path, Path(args.json_out), Path(args.txt_out))

    print(f"Rows: {len(rows)}")
    print(f"Brands: {len({r.brand for r in rows})}")
    print(f"JSON: {args.json_out}")
    print(f"TXT: {args.txt_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
