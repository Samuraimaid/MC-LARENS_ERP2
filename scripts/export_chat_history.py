#!/usr/bin/env python3
"""
==============================================================================
MC-LARENS ERP 2.0 - Exportador y Respaldo de Historial de Chat
==============================================================================
Este script lee los registros de transcripción generados por el sistema
y los formatea en un archivo markdown estructurado en 'memory/chat-log.md'
para asegurar la persistencia local de todas las sesiones de trabajo.
==============================================================================
"""

import os
import json
import glob
from pathlib import Path
from datetime import datetime

WORKSPACE_DIR = Path(__file__).resolve().parent.parent
MEMORY_FILE = WORKSPACE_DIR / "memory" / "chat-log.md"
APPDATA_DIR = Path(os.environ.get("USERPROFILE", "")) / ".gemini" / "antigravity-ide" / "brain"

def find_latest_transcript() -> Path:
    """Busca el archivo transcript.jsonl más reciente."""
    pattern = str(APPDATA_DIR / "**" / ".system_generated" / "logs" / "transcript.jsonl")
    files = glob.glob(pattern, recursive=True)
    if not files:
        return None
    # Ordenar por fecha de modificación
    files.sort(key=lambda f: os.path.getmtime(f), reverse=True)
    return Path(files[0])

def export_transcript_summary():
    transcript_path = find_latest_transcript()
    if not transcript_path or not transcript_path.exists():
        print("[INFO] No se encontró archivo de transcript activo en AppData.")
        return

    print(f"[INFO] Leyendo transcript desde: {transcript_path}")
    
    entries = []
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                step_type = data.get("type", "")
                content = data.get("content", "")
                if step_type == "USER_INPUT" and content:
                    entries.append(f"**Usuario:** {content.strip()}")
                elif step_type == "PLANNER_RESPONSE" and content:
                    # Guardar resumen de respuesta
                    first_lines = "\n".join(content.strip().split("\n")[:4])
                    entries.append(f"**Asistente (Resumen):** {first_lines}...")
            except Exception:
                continue

    if entries:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(MEMORY_FILE, "a", encoding="utf-8") as f:
            f.write(f"\n\n### Respaldo Automático de Conversación ({timestamp})\n")
            for entry in entries[-10:]:  # Últimas 10 interacciones clave
                f.write(f"- {entry}\n")
        print(f"[EXITO] Historial actualizado en {MEMORY_FILE}")

if __name__ == "__main__":
    export_transcript_summary()
