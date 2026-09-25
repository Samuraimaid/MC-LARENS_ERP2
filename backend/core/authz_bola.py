"""
Módulo de Autorización Estricta (Authz), Mitigación de BOLA y Mínimo Privilegio (C3).
MC-LARENS ERP2 - Fase 2 Seguridad P1 (S5 + C3: Top 12 #2 Authorization + Top 12 #8 Least Privilege).

Garantías:
1. Prevención BOLA (Broken Object Level Authorization):
   - Los usuarios sólo pueden acceder a recursos (ventas, órdenes de trabajo, muestras)
     que les pertenezcan o que pertenezcan a su propia sucursal asignada.
   - Roles globales administrativos (gerencia, supervisor, recursos humanos, programador)
     tienen acceso multi-sucursal irrestricto.
   - Rechazo cerrado: Intento de acceso a un recurso ajeno devuelve HTTP 403 FORBIDDEN.
2. Separación de Lectura vs Mutaciones Privilegiadas (C3):
   - Lecturas de catálogo y productos abiertas a todos los usuarios autenticados.
   - Mutaciones de dinero (cobro, anulación, arqueo, cierre): requieren roles de caja/gerencia.
   - Mutaciones de stock/inventario (crear producto, editar catálogo): requieren roles de bodega/gerencia.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional, Set

try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: Any = None):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")

logger = logging.getLogger(__name__)

# Roles administrativos con visibilidad global cross-sucursal
GLOBAL_ADMIN_ROLES: Set[str] = {
    "gerencia",
    "supervisor",
    "recursos_humanos",
    "programador",
    "admin",
}

# Roles permitidos para mutaciones de dinero / caja
MONEY_MUTATION_ROLES: Set[str] = {
    "gerencia",
    "supervisor",
    "cajero",
}

# Roles permitidos para mutaciones de stock / inventario
STOCK_MUTATION_ROLES: Set[str] = {
    "gerencia",
    "supervisor",
    "bodegas",
    "jefe_tienda",
}

# Roles permitidos para creación y cierre de ventas
SALES_MUTATION_ROLES: Set[str] = {
    "gerencia",
    "supervisor",
    "ventas",
    "jefe_vendedores",
    "jefe_tienda",
    "cajero",
}


def has_role(user: Any, allowed_roles: Iterable[str]) -> bool:
    """Verifica si el rol del usuario se encuentra en el conjunto permitido."""
    user_role = str(getattr(user, "role", "") or "").strip().lower()
    allowed_set = {str(r).strip().lower() for r in allowed_roles}
    return user_role in allowed_set


def enforce_role(user: Any, allowed_roles: Iterable[str], action: str = "operación") -> None:
    """
    Exige que el usuario posea uno de los roles permitidos.
    Lanza HTTP 403 Forbidden si el rol no está autorizado.
    """
    user_role = str(getattr(user, "role", "") or "sin_rol").strip()
    if not has_role(user, allowed_roles):
        logger.warning(
            "[AUTHZ_DENIED] Usuario %s (rol=%s) intentó ejecutar %s no autorizada",
            getattr(user, "user_id", "anon"),
            user_role,
            action,
        )
        raise HTTPException(
            status_code=403,
            detail={
                "error": "FORBIDDEN_ROLE",
                "message": f"El rol '{user_role}' no está autorizado para realizar esta {action}.",
                "allowed_roles": list(allowed_roles),
            },
        )


def can_access_resource(
    user: Any,
    resource_doc: Dict[str, Any],
    *,
    owner_field: str = "salesperson_id",
    branch_field: str = "branch_id",
    extra_owner_fields: Optional[List[str]] = None,
) -> bool:
    """
    Determina si un usuario tiene autorización para acceder a una entidad/objeto (BOLA guard).
    Retorna True si:
    1. El usuario posee rol administrativo global (gerencia, supervisor, etc.).
    2. El ID del usuario coincide con el propietario principal o campos secundarios.
    3. La sucursal del usuario coincide con la sucursal del recurso.
    4. El recurso no tiene restricciones de sucursal ni propietario (objeto público o global).
    """
    user_role = str(getattr(user, "role", "") or "").strip().lower()
    if user_role in GLOBAL_ADMIN_ROLES:
        return True

    user_id = str(getattr(user, "user_id", "") or "").strip()
    user_branch = str(getattr(user, "branch_id", "") or "").strip()

    # Si no hay documento o no hay usuario identificado, denegar
    if not resource_doc or not user_id:
        return False

    # 1. Chequeo de propietario principal
    owner_id = str(resource_doc.get(owner_field) or "").strip()
    if owner_id and owner_id == user_id:
        return True

    # 2. Chequeo de campos secundarios de propietario (ej. technician_id, requested_by, created_by)
    if extra_owner_fields:
        for fld in extra_owner_fields:
            alt_id = str(resource_doc.get(fld) or "").strip()
            if alt_id and alt_id == user_id:
                return True

    # 3. Chequeo de sucursal (tenancy por sucursal)
    res_branch = str(resource_doc.get(branch_field) or "").strip()
    if res_branch and user_branch and res_branch == user_branch:
        return True

    # 4. Si el recurso no especifica sucursal ni propietario alguno, se permite acceso
    if not res_branch and not owner_id:
        return True

    # Falla cerrado: el recurso pertenece a otra sucursal u otro usuario no administrativo
    return False


def enforce_resource_ownership(
    user: Any,
    resource_doc: Dict[str, Any],
    *,
    resource_name: str = "recurso",
    owner_field: str = "salesperson_id",
    branch_field: str = "branch_id",
    extra_owner_fields: Optional[List[str]] = None,
) -> None:
    """
    Valida la autorización a nivel de objeto (BOLA).
    Si el usuario no tiene acceso al recurso específico, levanta HTTP 403 Forbidden.
    """
    if not can_access_resource(
        user,
        resource_doc,
        owner_field=owner_field,
        branch_field=branch_field,
        extra_owner_fields=extra_owner_fields,
    ):
        user_id = str(getattr(user, "user_id", "anon"))
        user_role = str(getattr(user, "role", "unknown"))
        logger.warning(
            "[BOLA_VIOLATION] Acceso denegado a %s para usuario=%s (rol=%s, branch=%s)",
            resource_name,
            user_id,
            user_role,
            getattr(user, "branch_id", None),
        )
        raise HTTPException(
            status_code=403,
            detail={
                "error": "FORBIDDEN_OBJECT_ACCESS",
                "message": f"No tiene permiso para acceder a este {resource_name} (pertenece a otra sucursal o vendedor).",
            },
        )
