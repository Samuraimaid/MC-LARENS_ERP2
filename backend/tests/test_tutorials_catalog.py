from backend.domains.ui.tutorials import (
    can_edit_tutorials,
    can_view_all_tracks,
    catalog_for_role,
    default_curriculum,
    get_module_from_curriculum,
    merge_curriculum,
    normalize_module,
)


def test_default_has_multi_role_tracks():
    cur = default_curriculum()
    assert "ventas" in cur["tracks"]
    assert "cajero" in cur["tracks"]
    assert "bodegas" in cur["tracks"]
    assert "coordinador_instalaciones" in cur["tracks"]
    assert len(cur["tracks"]["ventas"]["modules"]) >= 5


def test_ventas_sees_only_own_track():
    cur = default_curriculum()
    cat = catalog_for_role(cur, viewer_role="ventas", full=True)
    assert cat["can_edit"] is False
    assert cat["can_view_all_tracks"] is False
    assert cat["selected_track"] == "ventas"
    assert len(cat["available_tracks"]) == 1
    assert cat["modules_full"][0]["steps"]


def test_gerencia_sees_all_and_can_edit():
    cur = default_curriculum()
    cat = catalog_for_role(cur, viewer_role="gerencia", track_role="cajero", full=False)
    assert cat["can_edit"] is True
    assert cat["can_view_all_tracks"] is True
    assert cat["selected_track"] == "cajero"
    assert len(cat["available_tracks"]) >= 5


def test_programador_can_edit():
    assert can_edit_tutorials("programador") is True
    assert can_view_all_tracks("programador") is True
    assert can_edit_tutorials("ventas") is False


def test_merge_override_replaces_track_modules():
    base = default_curriculum()
    override = {
        "tracks": {
            "ventas": {
                "label": "Vendedor custom",
                "modules": [
                    {
                        "id": "custom-1",
                        "order": 1,
                        "title": "Modulo custom",
                        "summary": "test",
                        "level": "basico",
                        "duration_min": 3,
                        "steps": [{"title": "Paso", "detail": "Detalle"}],
                    }
                ],
            }
        }
    }
    merged = merge_curriculum(override)
    mods = merged["tracks"]["ventas"]["modules"]
    assert len(mods) == 1
    assert mods[0]["id"] == "custom-1"


def test_normalize_module_requires_id_title():
    assert normalize_module({"title": "x"}) is None
    m = normalize_module(
        {
            "id": "a",
            "title": "Titulo",
            "steps": [{"title": "S1", "detail": "D1"}],
            "dos": ["ok"],
        }
    )
    assert m["id"] == "a"
    assert m["steps"][0]["title"] == "S1"


def test_get_module_from_curriculum():
    cur = default_curriculum()
    mid = cur["tracks"]["cajero"]["modules"][0]["id"]
    found = get_module_from_curriculum(cur, "cajero", mid)
    assert found is not None
    assert found["id"] == mid
