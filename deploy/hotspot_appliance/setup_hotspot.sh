#!/usr/bin/env bash
# ==============================================================================
# MC-LARENS WiFi Hotspot Appliance Installer for HP Mini PC
# Transforms any HP Mini PC (Ubuntu/Debian) with USB WiFi antenna into an
# enterprise customer captive portal with real-time ERP synchronization.
# ==============================================================================

set -e

echo ">>> Instalando dependencias de red y firewall para Hotspot MC-LARENS..."
sudo apt-get update
sudo apt-get install -y hostapd dnsmasq iptables iptables-persistent python3 python3-pip iw

WIFI_IFACE="wlan0"
HOTSPOT_IP="10.50.0.1"
NETMASK="255.255.255.0"
SSID_NAME="MC-LARENS Clientes VIP"

echo ">>> Configurando interfaz WiFi ($WIFI_IFACE)..."
sudo ip addr add ${HOTSPOT_IP}/24 dev ${WIFI_IFACE} || true
sudo ip link set ${WIFI_IFACE} up

# 1. Configure dnsmasq DHCP Server for Hotspot Subnet
echo ">>> Configurando servidor DHCP dnsmasq..."
sudo tee /etc/dnsmasq.d/mclarens_hotspot.conf > /dev/null <<EOF
interface=${WIFI_IFACE}
dhcp-range=10.50.0.10,10.50.0.250,255.255.255.0,12h
dhcp-option=3,${HOTSPOT_IP}
dhcp-option=6,8.8.8.8,1.1.1.1
address=/#/${HOTSPOT_IP}
EOF

# 2. Configure hostapd Access Point (WPA2 or Open with Captive Portal)
echo ">>> Configurando hostapd..."
sudo tee /etc/hostapd/hostapd.conf > /dev/null <<EOF
interface=${WIFI_IFACE}
driver=nl80211
ssid=${SSID_NAME}
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
EOF

# 3. Configure IP Forwarding & Captive Portal Redirection
echo ">>> Configurando IP forwarding e iptables..."
sudo sysctl -w net.ipv4.ip_forward=1

# Redirect unauthenticated HTTP traffic to Python Captive Portal on port 8080
sudo iptables -t nat -A PREROUTING -i ${WIFI_IFACE} -p tcp --dport 80 -j REDIRECT --to-ports 8080
sudo iptables -t nat -A PREROUTING -i ${WIFI_IFACE} -p tcp --dport 443 -j REDIRECT --to-ports 8080
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# 4. Create systemd service for Python Hotspot Daemon
echo ">>> Creando servicio systemd para el Daemon Hotspot..."
APPLIANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sudo tee /etc/systemd/system/mclarens-hotspot.service > /dev/null <<EOF
[Unit]
Description=MC-LARENS Customer WiFi Hotspot & ERP Sync Daemon
After=network.target hostapd.service dnsmasq.service

[Service]
Type=simple
User=root
WorkingDirectory=${APPLIANCE_DIR}
ExecStart=/usr/bin/python3 ${APPLIANCE_DIR}/mclarens_hotspot_daemon.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable dnsmasq hostapd mclarens-hotspot.service
sudo systemctl restart dnsmasq hostapd mclarens-hotspot.service

echo "=========================================================================="
echo ">>> Hotspot MC-LARENS instalado y en ejecución exitosamente!"
echo ">>> SSID: ${SSID_NAME}"
echo ">>> IP de Puerta de Enlace: ${HOTSPOT_IP}"
echo "=========================================================================="
