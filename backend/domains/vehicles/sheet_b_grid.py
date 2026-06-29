"""Parsed grid layout for sheet-b (multi-row vehicle icon pack)."""
from __future__ import annotations

from PIL import Image

from backend.domains.vehicles.thumbnails import _to_rgba

# Detected from sheet-truck-set.jpg (1000x572).
SHEET_B_ROWS: dict[int, list[tuple[int, int]]] = {
    2: [(51, 141), (160, 244), (283, 373), (402, 494), (512, 608), (641, 735), (760, 849), (863, 949)],
    8: [(55, 139), (156, 233), (251, 361), (381, 492), (508, 652), (688, 759), (776, 852), (867, 946)],
}

SHEET_B_ROW_BOUNDS: dict[int, tuple[int, int]] = {
    2: (87, 131),
    8: (435, 487),
}

# Row 2: hatchback, sedan, coupe, SUV, wagon, minivan, pickup, crew cab
# Row 8: vans and trucks (cargo van, box truck, cabezal)
TYPE_GRID_CELLS: dict[str, tuple[int, int]] = {
    "hatchback": (2, 1),
    "sedan": (2, 2),
    "convertible": (2, 3),
    "suv": (2, 4),
    "station-wagon": (2, 5),
    "microbus-pasajeros": (2, 6),
    "camioneta-1-cabina": (2, 7),
    "camioneta-cabina-y-media": (2, 8),
    "microbus-carga": (8, 3),
    "camion-carga": (8, 5),
    "cabezal": (8, 8),
    "default": (2, 2),
}


def crop_sheet_b_cell(image: Image.Image, row: int, col: int) -> Image.Image:
    if row not in SHEET_B_ROWS or col < 1 or col > len(SHEET_B_ROWS[row]):
        raise ValueError(f"Celda inválida en sheet-b: row={row} col={col}")
    top, bottom = SHEET_B_ROW_BOUNDS[row]
    left, right = SHEET_B_ROWS[row][col - 1]
    return _to_rgba(image).crop((left, top, right + 1, bottom + 1))