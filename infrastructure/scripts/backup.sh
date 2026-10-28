#!/usr/bin/env bash
#
# Encrypted backup and tested restore for the production compose stack (TPN review TM-009).
#
#   backup.sh keygen  <dir>                       create the backup key pair
#   backup.sh backup  [--out DIR] [--no-media] [--media-dir DIR]
#   backup.sh verify  <backup-dir> --key FILE     restore the database into a scratch database, check, drop it
#   backup.sh restore <backup-dir> --key FILE [--db NAME] [--yes-overwrite] [--media] [--media-dir DIR]
#
# Backups are encrypted with a PUBLIC certificate (CMS, AES-256-GCM), so the server holds only the key
# that can encrypt, never the one that can read. Keep the private key (backup-private.pem) off the
# server, with the other secrets, and test a restore with `verify` regularly. Streams are cut into
# parts (BACKUP_PART_MB, default 256) and each part is encrypted on its own, because decrypting needs
# about three times a part's size in memory.
#
# What is backed up: the PostgreSQL database (pg_dump custom format) and the uploads. Redis holds only
# cache and queue state and is not backed up. The TLS volumes (tls_data, tls_ca) and the environment
# file hold secrets: back those up with your secret store, not with this script.
#
# Environment:
#   BACKUP_CERT      public certificate to encrypt to (default ./backup-cert.pem)
#   BACKUP_PART_MB   part size in MB (default 256)
#   BACKUP_KEEP      newest backups to keep when pruning (default 14; 0 keeps all)
#   COMPOSE          the docker compose command (default: base + prod files, from the repository root)
#   MEDIA_SERVICE    compose service whose /app/media holds the uploads (default django)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE="${COMPOSE:-docker compose -f infrastructure/compose/compose.yml -f infrastructure/compose/compose.prod.yml}"
MEDIA_SERVICE="${MEDIA_SERVICE:-django}"
PART_MB="${BACKUP_PART_MB:-256}"
KEEP="${BACKUP_KEEP:-14}"
CERT="${BACKUP_CERT:-./backup-cert.pem}"

die() { echo "backup.sh: $*" >&2; exit 1; }

# --- encryption primitives -------------------------------------------------------------------------

# stdin -> encrypted parts "<prefix>NNNN.cms"
encrypt_stream() {
    local prefix="$1"
    [ -r "$CERT" ] || die "certificate $CERT not found (run: backup.sh keygen DIR)"
    export CERT
    split -b "${PART_MB}M" -d -a 4 \
        --filter='openssl cms -encrypt -binary -stream -aes-256-gcm -recip "$CERT" -outform DER -out "$FILE.cms"' \
        - "$prefix"
}

# decrypted bytes of every part matching "<prefix>*.cms", in order, on stdout
decrypt_parts() {
    local prefix="$1" key="$2" part found=0
    for part in "$prefix"*.cms; do
        [ -e "$part" ] || break
        found=1
        openssl cms -decrypt -binary -inform DER -inkey "$key" -in "$part"
    done
    [ "$found" = 1 ] || die "no parts found for $prefix"
}

check_sums() {
    (cd "$1" && sha256sum --check --quiet SHA256SUMS) || die "checksum mismatch in $1: the backup is damaged or was altered"
}

psql_exec() { $COMPOSE exec -T postgres sh -c "$1"; }

# A restore that fails (wrong key, damaged part) must not leave the empty database it created behind.
CREATED_DB=""
RESTORE_OK=0
cleanup() {
    if [ -n "$CREATED_DB" ] && [ "$RESTORE_OK" != 1 ]; then
        psql_exec "dropdb -U \"\$POSTGRES_USER\" --if-exists $CREATED_DB" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# --- commands --------------------------------------------------------------------------------------

cmd_keygen() {
    local dir="${1:-}"
    [ -n "$dir" ] || die "usage: backup.sh keygen <dir>"
    mkdir -p "$dir"
    [ ! -e "$dir/backup-private.pem" ] || die "$dir/backup-private.pem already exists; not overwriting"
    (
        umask 077
        openssl req -x509 -newkey rsa:4096 -nodes -sha256 -days 3650 \
            -subj "/CN=StudioHub backup" \
            -keyout "$dir/backup-private.pem" -out "$dir/backup-cert.pem"
    ) 2>/dev/null
    chmod 600 "$dir/backup-private.pem"
    echo "Created $dir/backup-cert.pem (public: keep on the server, set BACKUP_CERT)"
    echo "Created $dir/backup-private.pem (SECRET: move it off this machine now; without it no backup can be read)"
}

cmd_backup() {
    local out="./backups" media=1 media_dir=""
    while [ $# -gt 0 ]; do
        case "$1" in
            --out) out="$2"; shift 2 ;;
            --no-media) media=0; shift ;;
            --media-dir) media_dir="$2"; shift 2 ;;
            *) die "unknown option $1" ;;
        esac
    done

    local stamp dir
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    dir="$out/$stamp"
    (umask 077; mkdir -p "$dir")
    umask 077

    echo "Database -> $dir/db.part_*.cms"
    psql_exec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | encrypt_stream "$dir/db.part_"

    if [ "$media" = 1 ]; then
        echo "Uploads  -> $dir/media.part_*.cms"
        if [ -n "$media_dir" ]; then
            tar -C "$media_dir" -cf - . | encrypt_stream "$dir/media.part_"
        else
            $COMPOSE exec -T "$MEDIA_SERVICE" tar -C /app/media -cf - . | encrypt_stream "$dir/media.part_"
        fi
    fi

    (cd "$dir" && sha256sum ./*.cms > SHA256SUMS)
    printf 'created=%s\nformat=pg_dump -Fc; tar\nencryption=CMS AES-256-GCM\npart_mb=%s\n' \
        "$stamp" "$PART_MB" > "$dir/MANIFEST.txt"

    if [ "$KEEP" -gt 0 ]; then
        # shellcheck disable=SC2012
        ls -1d "$out"/*/ 2>/dev/null | sort | head -n "-$KEEP" | while read -r old; do
            echo "Pruning $old"
            rm -rf -- "$old"
        done
    fi

    echo "Backup complete: $dir"
}

restore_database() {
    local dir="$1" key="$2" db="$3" overwrite="$4" flags="--no-owner"
    [ "$overwrite" = 1 ] && flags="--no-owner --clean --if-exists"
    decrypt_parts "$dir/db.part_" "$key" \
        | psql_exec "pg_restore $flags -U \"\$POSTGRES_USER\" -d $db"
}

cmd_verify() {
    local dir="${1:-}" key=""
    shift || true
    while [ $# -gt 0 ]; do
        case "$1" in
            --key) key="$2"; shift 2 ;;
            *) die "unknown option $1" ;;
        esac
    done
    [ -d "$dir" ] && [ -r "$key" ] || die "usage: backup.sh verify <backup-dir> --key FILE"
    check_sums "$dir"

    local scratch="restore_check_$$"
    echo "Restoring the database into scratch database $scratch ..."
    psql_exec "createdb -U \"\$POSTGRES_USER\" $scratch"
    trap 'psql_exec "dropdb -U \"\$POSTGRES_USER\" --if-exists '"$scratch"'" >/dev/null 2>&1 || true' EXIT

    restore_database "$dir" "$key" "$scratch" 0

    local tables rows
    tables="$(psql_exec "psql -U \"\$POSTGRES_USER\" -d $scratch -tAc \"select count(*) from information_schema.tables where table_schema = 'public'\"" | tr -d '[:space:]')"
    rows="$(psql_exec "psql -U \"\$POSTGRES_USER\" -d $scratch -tAc \"select coalesce(sum(n_live_tup), 0)::bigint from pg_stat_user_tables\"" | tr -d '[:space:]')"
    [ "${tables:-0}" -gt 0 ] || die "the restored database has no tables"
    echo "Restore verified: $tables tables, about $rows rows. The scratch database is dropped."
}

cmd_restore() {
    local dir="${1:-}" key="" db="" overwrite=0 media=0 media_dir=""
    shift || true
    while [ $# -gt 0 ]; do
        case "$1" in
            --key) key="$2"; shift 2 ;;
            --db) db="$2"; shift 2 ;;
            --yes-overwrite) overwrite=1; shift ;;
            --media) media=1; shift ;;
            --media-dir) media_dir="$2"; media=1; shift 2 ;;
            *) die "unknown option $1" ;;
        esac
    done
    [ -d "$dir" ] && [ -r "$key" ] || die "usage: backup.sh restore <backup-dir> --key FILE [--db NAME] [--yes-overwrite]"
    check_sums "$dir"

    if [ -z "$db" ]; then
        [ "$overwrite" = 1 ] || die "restoring into the live database replaces its contents: pass --yes-overwrite, or --db NAME for another database"
        db='"$POSTGRES_DB"'
        echo "Restoring over the live database ..."
    else
        psql_exec "createdb -U \"\$POSTGRES_USER\" $db"
        echo "Restoring into new database $db ..."
        CREATED_DB="$db"
    fi

    restore_database "$dir" "$key" "$db" "$overwrite"
    RESTORE_OK=1

    if [ "$media" = 1 ]; then
        echo "Restoring uploads ..."
        if [ -n "$media_dir" ]; then
            mkdir -p "$media_dir"
            decrypt_parts "$dir/media.part_" "$key" | tar -C "$media_dir" -xf -
        else
            decrypt_parts "$dir/media.part_" "$key" | $COMPOSE exec -T "$MEDIA_SERVICE" tar -C /app/media -xf -
        fi
    fi
    echo "Restore complete."
}

case "${1:-}" in
    keygen) shift; cmd_keygen "$@" ;;
    backup) shift; cmd_backup "$@" ;;
    verify) shift; cmd_verify "$@" ;;
    restore) shift; cmd_restore "$@" ;;
    *) sed -n '3,12p' "$0"; exit 2 ;;
esac
