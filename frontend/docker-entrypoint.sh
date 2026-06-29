#!/bin/sh
set -eu

CERT_DIR=/etc/nginx/certs
mkdir -p "$CERT_DIR"

HTTPS_CERT_CN="${HTTPS_CERT_CN:-localhost}"
HTTPS_CERT_DNS="${HTTPS_CERT_DNS:-localhost}"
HTTPS_CERT_IPS="${HTTPS_CERT_IPS:-127.0.0.1}"
STAMP_FILE="$CERT_DIR/cert-sans.stamp"
CURRENT_STAMP="${HTTPS_CERT_CN}|${HTTPS_CERT_DNS}|${HTTPS_CERT_IPS}"

if [ ! -f "$CERT_DIR/server.crt" ] \
  || [ ! -f "$CERT_DIR/server.key" ] \
  || [ "$(cat "$STAMP_FILE" 2>/dev/null || true)" != "$CURRENT_STAMP" ]; then
  OPENSSL_CFG="$(mktemp)"
  DNS_INDEX=1
  IP_INDEX=1

  {
    echo "[req]"
    echo "distinguished_name = req_distinguished_name"
    echo "x509_extensions = v3_req"
    echo "prompt = no"
    echo ""
    echo "[req_distinguished_name]"
    echo "CN = ${HTTPS_CERT_CN}"
    echo "O = MC-LARENS ERP"
    echo ""
    echo "[v3_req]"
    echo "subjectAltName = @alt_names"
    echo ""
    echo "[alt_names]"
  } > "$OPENSSL_CFG"

  OLD_IFS=$IFS
  IFS=,
  for dns_name in $HTTPS_CERT_DNS; do
    dns_name=$(echo "$dns_name" | tr -d ' ')
    [ -n "$dns_name" ] || continue
    echo "DNS.${DNS_INDEX} = ${dns_name}" >> "$OPENSSL_CFG"
    DNS_INDEX=$((DNS_INDEX + 1))
  done

  for ip_name in $HTTPS_CERT_IPS; do
    ip_name=$(echo "$ip_name" | tr -d ' ')
    [ -n "$ip_name" ] || continue
    echo "IP.${IP_INDEX} = ${ip_name}" >> "$OPENSSL_CFG"
    IP_INDEX=$((IP_INDEX + 1))
  done
  IFS=$OLD_IFS

  openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -config "$OPENSSL_CFG" \
    -extensions v3_req

  echo "$CURRENT_STAMP" > "$STAMP_FILE"
  rm -f "$OPENSSL_CFG"
fi

exec "$@"