import asyncio
import re
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from pydantic import BaseModel
import pytest

pytestmark = pytest.mark.asyncio


async def test_vehicle_idempotent_duplicate_prevention_same_customer():
    """Verify that registering the same plate/VIN for the same customer returns existing vehicle without duplicating."""
    import backend.server as server
    from backend.server import create_vehicle, VehicleCreate
    
    mock_request = MagicMock()
    mock_user = MagicMock()
    mock_user.user_id = "usr_seller_01"
    mock_user.role = "vendedor"
    
    existing_veh = {
        "vehicle_id": "veh_existing_123",
        "customer_id": "cust_001",
        "brand": "NISSAN",
        "model": "Altima",
        "year": 2008,
        "plate": "M 245 285",
        "vin": "1N4AL21E88C123456",
        "color": None,
    }
    
    mock_db = MagicMock()
    mock_db.vehicles.find_one = AsyncMock(return_value=existing_veh)
    mock_db.vehicles.update_one = AsyncMock()
    mock_db.vehicles.insert_one = AsyncMock()
    
    with patch("backend.server.require_auth", AsyncMock(return_value=mock_user)), \
         patch.object(server, "db", mock_db):
        
        payload = VehicleCreate(
            customer_id="cust_001",
            brand="NISSAN",
            model="Altima",
            year=2008,
            plate="M 245 285",
            vin="1N4AL21E88C123456",
            color="Gris Plata"
        )
        
        result = await create_vehicle(payload, mock_request)
        
        # Must return the existing vehicle without inserting a duplicate
        assert result["vehicle_id"] == "veh_existing_123"
        mock_db.vehicles.insert_one.assert_not_called()
        mock_db.vehicles.update_one.assert_called_once()


async def test_vehicle_ownership_conflict_different_customer():
    """Verify that registering an already owned vehicle for a different customer raises 409 Conflict with owner info."""
    import backend.server as server
    from backend.server import create_vehicle, VehicleCreate
    
    mock_request = MagicMock()
    mock_user = MagicMock()
    mock_user.user_id = "usr_seller_01"
    mock_user.role = "vendedor"
    
    existing_veh = {
        "vehicle_id": "veh_existing_123",
        "customer_id": "cust_previous_owner",
        "brand": "NISSAN",
        "model": "Altima",
        "year": 2008,
        "plate": "M 245 285",
        "vin": "1N4AL21E88C123456",
        "color": "Negro",
    }
    
    prev_cust = {
        "customer_id": "cust_previous_owner",
        "name": "Comercializadora San Juan S.A.",
        "type": "empresa",
        "tax_id": "J0310000123456",
        "phone": "+505-8888-9999"
    }
    
    mock_db = MagicMock()
    mock_db.vehicles.find_one = AsyncMock(return_value=existing_veh)
    mock_db.customers.find_one = AsyncMock(return_value=prev_cust)
    mock_db.vehicles.insert_one = AsyncMock()
    
    with patch("backend.server.require_auth", AsyncMock(return_value=mock_user)), \
         patch.object(server, "db", mock_db):
        
        payload = VehicleCreate(
            customer_id="cust_new_owner",
            brand="NISSAN",
            model="Altima",
            year=2008,
            plate="M 245 285",
            vin="1N4AL21E88C123456",
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await create_vehicle(payload, mock_request)
        
        assert exc_info.value.status_code == 409
        detail = exc_info.value.detail
        assert detail["code"] == "VEHICLE_OWNED_BY_ANOTHER"
        assert detail["owner_info"]["name"] == "Comercializadora San Juan S.A."
        assert detail["existing_vehicle"]["vehicle_id"] == "veh_existing_123"
        mock_db.vehicles.insert_one.assert_not_called()


async def test_supervisor_transfer_vehicle_owner_endpoint():
    """Verify that a supervisor can transfer vehicle ownership and log an audit trail."""
    import backend.server as server
    from backend.server import transfer_vehicle_owner, VehicleOwnerTransferPayload
    
    mock_request = MagicMock()
    mock_user = MagicMock()
    mock_user.user_id = "usr_supervisor_01"
    mock_user.name = "Carlos Gerente"
    mock_user.role = "gerencia"
    
    existing_veh = {
        "vehicle_id": "veh_altima_01",
        "customer_id": "cust_prev_01",
        "brand": "NISSAN",
        "model": "Altima",
        "year": 2008,
        "plate": "M 245 285",
        "vin": "1N4AL21E88C123456",
    }
    
    target_cust = {
        "customer_id": "cust_new_02",
        "name": "Mario Rivas",
        "first_name": "Mario",
        "last_name": "Rivas"
    }
    
    updated_veh = {**existing_veh, "customer_id": "cust_new_02"}
    
    mock_db = MagicMock()
    mock_db.vehicles.find_one = AsyncMock(side_effect=[existing_veh, updated_veh])
    mock_db.customers.find_one = AsyncMock(side_effect=[target_cust, None])
    mock_db.vehicles.update_one = AsyncMock()
    mock_db.vehicle_transfer_logs.insert_one = AsyncMock()
    
    with patch("backend.server.require_auth", AsyncMock(return_value=mock_user)), \
         patch.object(server, "db", mock_db):
        
        payload = VehicleOwnerTransferPayload(
            target_customer_id="cust_new_02",
            reason="Venta de vehículo a nuevo comprador"
        )
        
        response = await transfer_vehicle_owner("veh_altima_01", payload, mock_request)
        
        assert response["success"] is True
        assert response["vehicle"]["customer_id"] == "cust_new_02"
        mock_db.vehicles.update_one.assert_called_once()
        mock_db.vehicle_transfer_logs.insert_one.assert_called_once()
        log_entry = mock_db.vehicle_transfer_logs.insert_one.call_args[0][0]
        assert log_entry["new_customer_name"] == "Mario Rivas"
        assert log_entry["authorized_by_name"] == "Carlos Gerente"
