#!/usr/bin/env python3
"""
==============================================================================
MC-LARENS ERP 2.0 - Backup Automático a Google Drive (Plan 5 TB)
==============================================================================
Este script realiza el volcado de la base de datos MongoDB del ERP,
comprime el archivo con timestamp y lo sube directamente a tu almacenamiento
de 5 TB en Google Drive utilizando la API oficial de Google.

Requisitos:
- pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib pymongo
==============================================================================
"""

import os
import sys
import gzip
import json
import shutil
import tarfile
import logging
import argparse
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("erp.backup_gdrive")

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKUPS_DIR = ROOT_DIR / "backups" / "mongodb"


def get_backup_filename(branch_id: str = "branch_main") -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return f"mclarens_erp_backup_{branch_id}_{timestamp}.tar.gz"


def dump_mongodb_native(mongo_uri: str, db_name: str, output_dir: Path) -> Path:
    """Intenta volcar MongoDB usando mongodump si está instalado en el sistema."""
    temp_dump_dir = output_dir / "temp_dump"
    if temp_dump_dir.exists():
        shutil.rmtree(temp_dump_dir, ignore_errors=True)
    temp_dump_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "mongodump",
        f"--uri={mongo_uri}",
        f"--db={db_name}",
        f"--out={temp_dump_dir}"
    ]
    logger.info(f"Ejecutando mongodump para base de datos '{db_name}'...")
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return temp_dump_dir
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        logger.warning(f"mongodump no disponible en PATH ({exc}). Utilizando fallback en Python...")
        return None


def dump_mongodb_python(mongo_uri: str, db_name: str, output_dir: Path) -> Path:
    """Fallback: Vuelca MongoDB colección por colección a formato JSON comprimido."""
    from pymongo import MongoClient
    from bson.json_util import dumps

    temp_dump_dir = output_dir / "temp_dump_py" / db_name
    temp_dump_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Conectando a MongoDB: {mongo_uri} (Base: {db_name})")
    client = MongoClient(mongo_uri)
    db = client[db_name]

    collections = db.list_collection_names()
    logger.info(f"Exportando {len(collections)} colecciones...")

    for col_name in collections:
        if col_name.startswith("system."):
            continue
        col_file = temp_dump_dir / f"{col_name}.json.gz"
        cursor = db[col_name].find()
        count = 0
        with gzip.open(col_file, "wt", encoding="utf-8") as f:
            f.write("[\n")
            first = True
            for doc in cursor:
                if not first:
                    f.write(",\n")
                f.write(dumps(doc))
                first = False
                count += 1
            f.write("\n]\n")
        logger.info(f"  - Colección '{col_name}': {count} documentos exportados.")

    client.close()
    return temp_dump_dir.parent


def create_compressed_backup(source_dir: Path, output_file: Path) -> Path:
    """Comprime el directorio de volcado en un archivo .tar.gz."""
    logger.info(f"Comprimiendo respaldo en {output_file.name}...")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_file, "w:gz") as tar:
        tar.add(source_dir, arcname="dump")
    
    # Limpiar directorio temporal
    shutil.rmtree(source_dir, ignore_errors=True)
    size_mb = output_file.stat().st_size / (1024 * 1024)
    logger.info(f"Respaldo generado con éxito: {output_file.name} ({size_mb:.2f} MB)")
    return output_file


def upload_to_google_drive(file_path: Path, folder_id: Optional[str] = None, credentials_path: Optional[str] = None) -> Optional[str]:
    """Sube el archivo de respaldo a Google Drive usando la API oficial de Google."""
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        logger.error("Librerías de Google no instaladas. Ejecuta: pip install google-api-python-client google-auth")
        return None

    cred_file = credentials_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_file or not Path(cred_file).exists():
        logger.warning(f"No se encontró archivo de credenciales de Google Drive en '{cred_file}'. Guardando respaldo solo en disco local.")
        return None

    logger.info(f"Autenticando con cuenta de Google usando {cred_file}...")
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    creds = service_account.Credentials.from_service_account_file(cred_file, scopes=SCOPES)
    service = build('drive', 'v3', credentials=creds)

    file_metadata = {'name': file_path.name}
    target_folder = folder_id or os.environ.get("GOOGLE_DRIVE_BACKUP_FOLDER_ID")
    if target_folder:
        file_metadata['parents'] = [target_folder]

    media = MediaFileUpload(str(file_path), mimetype='application/gzip', resumable=True)
    logger.info(f"Subiendo {file_path.name} a tu Google Drive (5 TB)...")
    
    request = service.files().create(body=file_metadata, media_body=media, fields='id, name, webViewLink')
    uploaded_file = request.execute()
    file_id = uploaded_file.get('id')
    link = uploaded_file.get('webViewLink')
    logger.info(f"¡Respaldo subido a Google Drive exitosamente! ID: {file_id}")
    if link:
        logger.info(f"Enlace de acceso en Google Drive: {link}")
    return file_id


def cleanup_old_local_backups(backups_dir: Path, keep_count: int = 7) -> None:
    """Mantiene solo los últimos N respaldos locales para no llenar el disco."""
    archives = sorted(backups_dir.glob("mclarens_erp_backup_*.tar.gz"), key=lambda f: f.stat().st_mtime, reverse=True)
    if len(archives) > keep_count:
        for old in archives[keep_count:]:
            try:
                old.unlink()
                logger.info(f"Respaldo local antiguo eliminado: {old.name}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar {old.name}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Backup del ERP MC-LARENS a Google Drive (5 TB)")
    parser.add_argument("--mongo-uri", default=os.environ.get("MONGODB_LOCAL_URI", os.environ.get("MONGO_URL", "mongodb://localhost:27017")), help="URI de MongoDB")
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp"), help="Nombre de la base de datos")
    parser.add_argument("--branch-id", default=os.environ.get("BRANCH_ID", "branch_main"), help="ID de la sucursal")
    parser.add_argument("--folder-id", default=os.environ.get("GOOGLE_DRIVE_BACKUP_FOLDER_ID"), help="ID de carpeta en Google Drive")
    parser.add_argument("--credentials", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"), help="Ruta a google-service-account.json")
    parser.add_argument("--keep-local", type=int, default=7, help="Cantidad de respaldos locales a conservar")
    args = parser.parse_args()

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    backup_filename = get_backup_filename(args.branch_id)
    output_tar = BACKUPS_DIR / backup_filename

    logger.info("=== INICIANDO RESPALDO DE MC-LARENS ERP ===")
    
    # 1. Volcar MongoDB
    dump_dir = dump_mongodb_native(args.mongo_uri, args.db_name, BACKUPS_DIR)
    if not dump_dir:
        dump_dir = dump_mongodb_python(args.mongo_uri, args.db_name, BACKUPS_DIR)

    # 2. Empaquetar y comprimir
    compressed_file = create_compressed_backup(dump_dir, output_tar)

    # 3. Subir a Google Drive 5TB
    upload_to_google_drive(compressed_file, folder_id=args.folder_id, credentials_path=args.credentials)

    # 4. Limpieza de respaldos locales antiguos
    cleanup_old_local_backups(BACKUPS_DIR, keep_count=args.keep_local)

    logger.info("=== RESPALDO COMPLETADO EXITOSAMENTE ===")


if __name__ == "__main__":
    main()
