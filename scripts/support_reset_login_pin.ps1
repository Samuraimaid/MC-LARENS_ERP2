param(
  [string]$UserId,
  [string]$UserName,
  [string]$NewPin,
  [switch]$UnlockOnly,
  [switch]$Verify,
  [string]$BackendContainer = "mundo-backend",
  [string]$ApiBase = "http://127.0.0.1:8001/api"
)

$ErrorActionPreference = 'Stop'

function Assert-DockerContainerRunning {
  param([string]$ContainerName)
  $running = docker ps --format '{{.Names}}'
  if (-not ($running -contains $ContainerName)) {
    throw "El contenedor '$ContainerName' no está corriendo."
  }
}

function Get-ContainerEnvValue {
  param(
    [string]$ContainerName,
    [string]$Key,
    [string]$DefaultValue
  )
  $envLines = docker inspect $ContainerName --format "{{range .Config.Env}}{{println .}}{{end}}"
  $match = $envLines | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
  if (-not $match) {
    return $DefaultValue
  }
  return ($match -replace "^$Key=", "")
}

if (-not $UserId -and -not $UserName) {
  throw "Debes enviar -UserId o -UserName"
}

if (-not $UnlockOnly) {
  if (-not $NewPin) {
    throw "Debes enviar -NewPin (8 dígitos) o usar -UnlockOnly"
  }
  if ($NewPin -notmatch '^\d{8}$') {
    throw "-NewPin debe tener exactamente 8 dígitos"
  }
}

Assert-DockerContainerRunning -ContainerName $BackendContainer

$dbName = Get-ContainerEnvValue -ContainerName $BackendContainer -Key "DB_NAME" -DefaultValue "mundo_accesorios_erp"

$tmpPy = Join-Path $PSScriptRoot "_tmp_support_reset_login_pin.py"
$pyCode = @'
import hashlib
import json
import os
from datetime import datetime, timezone

import bcrypt
from pymongo import MongoClient


def main() -> int:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
    db_name = os.environ.get("DB_NAME", "mundo_accesorios_erp")
    user_id = os.environ.get("TARGET_USER_ID", "").strip()
    user_name = os.environ.get("TARGET_USER_NAME", "").strip()
    new_pin = os.environ.get("TARGET_NEW_PIN", "").strip()
    unlock_only = os.environ.get("TARGET_UNLOCK_ONLY", "false").lower() == "true"

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    query = {}
    if user_id:
        query = {"user_id": user_id}
    elif user_name:
        query = {"name": user_name}

    matches = list(db.users.find(query, {"_id": 0, "user_id": 1, "name": 1, "is_pin_user": 1, "is_active": 1}).limit(20))
    if not matches:
        print(json.dumps({"ok": False, "error": "user_not_found", "query": query}, ensure_ascii=False))
        return 1

    if not user_id and len(matches) > 1:
        print(json.dumps({"ok": False, "error": "multiple_users_with_name", "matches": matches}, ensure_ascii=False))
        return 1

    target = matches[0]
    update_set = {
        "failed_pin_attempts": 0,
        "pin_lockout_until": None,
    }

    if not unlock_only:
        update_set.update(
            {
                "login_pin_hash": bcrypt.hashpw(new_pin.encode(), bcrypt.gensalt()).decode(),
                "login_pin_index": hashlib.sha256(new_pin.encode()).hexdigest(),
                "login_pin_last_set_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    result = db.users.update_one({"user_id": target["user_id"]}, {"$set": update_set})

    print(
        json.dumps(
            {
                "ok": True,
                "action": "unlock_only" if unlock_only else "unlock_and_reset",
                "db": db_name,
                "user": target,
                "matched": result.matched_count,
                "modified": result.modified_count,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'@

Set-Content -Path $tmpPy -Value $pyCode -Encoding UTF8

try {
  docker cp $tmpPy "$BackendContainer`:/tmp/_tmp_support_reset_login_pin.py" | Out-Null

  $envParts = @(
    "-e MONGO_URL=mongodb://mongodb:27017",
    "-e DB_NAME=$dbName",
    "-e TARGET_USER_ID=$UserId",
    "-e TARGET_USER_NAME=$UserName",
    "-e TARGET_NEW_PIN=$NewPin",
    "-e TARGET_UNLOCK_ONLY=$($UnlockOnly.IsPresent.ToString().ToLower())"
  )

  $envStr = ($envParts -join " ")
  $cmd = "docker exec $envStr $BackendContainer python /tmp/_tmp_support_reset_login_pin.py"
  Write-Host "Ejecutando soporte PIN en contenedor..." -ForegroundColor Cyan
  $jsonOut = Invoke-Expression $cmd
  Write-Host $jsonOut

  if ($Verify -and -not $UnlockOnly -and $NewPin) {
    $targetUserId = $UserId
    if (-not $targetUserId) {
      $obj = $jsonOut | ConvertFrom-Json
      $targetUserId = $obj.user.user_id
    }

    if ($targetUserId) {
      $verifyBody = @{ user_id = $targetUserId; pin = $NewPin } | ConvertTo-Json
      try {
        $resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ApiBase/auth/pin/login" -ContentType "application/json" -Body $verifyBody
        Write-Host ("Verificación login OK: status=" + [int]$resp.StatusCode) -ForegroundColor Green
      } catch {
        Write-Host ("Verificación login falló: " + $_.Exception.Message) -ForegroundColor Yellow
      }
    }
  }
}
finally {
  Remove-Item $tmpPy -ErrorAction SilentlyContinue
  try {
    docker exec $BackendContainer rm -f /tmp/_tmp_support_reset_login_pin.py | Out-Null
  } catch {
  }
}