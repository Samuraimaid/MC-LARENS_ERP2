import os

from backend.domains.deployment.node_profile import build_node_profile, is_route_enabled


def test_bodega_pura_disables_sales_and_workshop(monkeypatch):
    monkeypatch.setenv("NODE_TYPE", "BODEGA_PURA")
    monkeypatch.setenv("BRANCH_ID", "warehouse_central")
    profile = build_node_profile()
    assert profile["node_type"] == "BODEGA_PURA"
    assert is_route_enabled("/sales", profile) is False
    assert is_route_enabled("/inventory", profile) is True
    assert is_route_enabled("/dispatch", profile) is True


def test_casa_matriz_keeps_full_features(monkeypatch):
    monkeypatch.setenv("NODE_TYPE", "CASA_MATRIZ")
    monkeypatch.setenv("BRANCH_ID", "branch_main")
    profile = build_node_profile()
    assert profile["node_type"] == "CASA_MATRIZ"
    assert is_route_enabled("/sales", profile) is True
    assert is_route_enabled("/work-orders", profile) is True
    assert is_route_enabled("/human-resources", profile) is True


def test_sucursal_modular_sales_switch(monkeypatch):
    monkeypatch.setenv("NODE_TYPE", "SUCURSAL")
    monkeypatch.setenv("NODE_ENABLE_SALES", "false")
    monkeypatch.setenv("NODE_ENABLE_WORKSHOP", "true")
    profile = build_node_profile()
    assert is_route_enabled("/workbench", profile) is False
    assert is_route_enabled("/work-orders", profile) is True