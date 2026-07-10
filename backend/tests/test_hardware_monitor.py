from pathlib import Path

from backend.services import hardware_monitor as hm


def test_usb_disconnected_alert(tmp_path, monkeypatch):
    monkeypatch.setattr(hm, "USB_ROOT", tmp_path / "missing_usb")
    alert = hm._check_usb_backup()
    assert alert is not None
    assert alert["code"] == "usb_disconnected"


def test_usb_empty_warning(tmp_path, monkeypatch):
    usb = tmp_path / "usb"
    usb.mkdir()
    monkeypatch.setattr(hm, "USB_ROOT", usb)
    alert = hm._check_usb_backup()
    assert alert is not None
    assert alert["code"] == "usb_empty"


def test_beep_flag_written(tmp_path, monkeypatch):
    flag = tmp_path / "beep.flag"
    monkeypatch.setattr(hm, "BEEP_FLAG_PATH", flag)
    hm._trigger_host_beep("database_corrupt")
    assert flag.exists()