#!/bin/sh
#
# One-shot internal TLS bootstrap (TPN review TM-009).
#
# Creates a private certificate authority and one server certificate per internal service, in two
# volumes: /ca (the CA key: only this job mounts it) and /tls (CA certificate, service certificates
# and keys, which the services mount read-only). Existing files are kept; a certificate that expires
# within RENEW_BEFORE_DAYS is reissued from the same CA, so re-running the job is the renewal.
#
# To replace the CA itself, delete both volumes and bring the stack up again (every service restarts).
# To use certificates from your own CA, place ca.pem and <service>.pem / <service>.key in the /tls
# volume yourself; files already present are not touched.

set -eu

CA_DIR="${CA_DIR:-/ca}"
TLS_DIR="${TLS_DIR:-/tls}"
RENEW_BEFORE_DAYS="${RENEW_BEFORE_DAYS:-30}"
LEAF_DAYS="${LEAF_DAYS:-397}"
CA_DAYS="${CA_DAYS:-3650}"

# service:uid that owns (and alone may read) the private key
SERVICES="postgres:999 redis:999 django:10001"

umask 077
mkdir -p "$CA_DIR" "$TLS_DIR"

if [ ! -f "$CA_DIR/ca.key" ] && [ ! -f "$TLS_DIR/ca.pem" ]; then
    echo "tls-init: creating the internal certificate authority"
    openssl ecparam -name prime256v1 -genkey -noout -out "$CA_DIR/ca.key"
    # Explicit CA extensions: strict verifiers (Python 3.13+, OpenSSL 3) refuse a CA without them.
    openssl req -x509 -new -key "$CA_DIR/ca.key" -sha256 -days "$CA_DAYS" \
        -subj "/CN=StudioHub internal CA" \
        -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
        -addext "keyUsage=critical,keyCertSign,cRLSign" \
        -addext "subjectKeyIdentifier=hash" \
        -out "$TLS_DIR/ca.pem"
fi

for entry in $SERVICES; do
    service="${entry%%:*}"
    owner="${entry##*:}"
    cert="$TLS_DIR/$service.pem"
    key="$TLS_DIR/$service.key"

    if [ -f "$cert" ] && [ -f "$key" ] \
        && openssl x509 -checkend $((RENEW_BEFORE_DAYS * 86400)) -noout -in "$cert" >/dev/null; then
        echo "tls-init: $service certificate is current"
    else
        [ -f "$CA_DIR/ca.key" ] || { echo "tls-init: no CA key to sign $service with" >&2; exit 1; }
        echo "tls-init: issuing the $service certificate"
        openssl ecparam -name prime256v1 -genkey -noout -out "$key"
        openssl req -new -key "$key" -subj "/CN=$service" -out "$TLS_DIR/$service.csr"
        printf '%s\n' \
            "basicConstraints=critical,CA:FALSE" \
            "keyUsage=critical,digitalSignature" \
            "extendedKeyUsage=serverAuth" \
            "subjectKeyIdentifier=hash" \
            "authorityKeyIdentifier=keyid" \
            "subjectAltName=DNS:$service,DNS:localhost,IP:127.0.0.1" > "$TLS_DIR/$service.ext"
        openssl x509 -req -in "$TLS_DIR/$service.csr" -CA "$TLS_DIR/ca.pem" -CAkey "$CA_DIR/ca.key" \
            -CAcreateserial -CAserial "$CA_DIR/ca.srl" -sha256 -days "$LEAF_DAYS" \
            -extfile "$TLS_DIR/$service.ext" -out "$cert"
        rm -f "$TLS_DIR/$service.csr" "$TLS_DIR/$service.ext"
    fi

    # The key belongs to the service's user and nobody else; the certificate is public.
    chown "$owner:$owner" "$key"
    chmod 600 "$key"
    chmod 644 "$cert"
done

chmod 644 "$TLS_DIR/ca.pem"
chmod 700 "$CA_DIR"
echo "tls-init: done"
