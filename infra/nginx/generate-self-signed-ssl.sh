#!/bin/sh
set -e

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

if [ ! -f "$CERTS_DIR/fullchain.pem" ] || [ ! -f "$CERTS_DIR/privkey.pem" ]; then
    echo "⚡ Generating self-signed SSL certificate for ComputeGrid..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/privkey.pem" \
        -out "$CERTS_DIR/fullchain.pem" \
        -subj "/C=US/ST=State/L=City/O=ComputeGrid/OU=Infra/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    echo "✅ Self-signed SSL certificate created in $CERTS_DIR"
else
    echo "ℹ️ Existing SSL certificate found in $CERTS_DIR. Skipping generation."
fi
