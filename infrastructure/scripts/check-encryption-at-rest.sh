#!/bin/sh
#
# Report whether the stack's data volumes sit on encrypted storage (TPN review TM-009).
#
# Run on the Docker host as a user who may inspect the volumes and the block devices (usually root).
# For every volume of the compose project it finds the backing device and looks for dm-crypt/LUKS in its
# stack, or a ZFS dataset with native encryption. Anything else is UNKNOWN: a cloud provider's
# volume encryption (EBS, Persistent Disk, ...) is applied below the guest and cannot be seen from here.
#
#   check-encryption-at-rest.sh [project-name]
#
# Environment:
#   PROVIDER_ENCRYPTION_REF  A reference to evidence that the provider encrypts the volumes (a ticket,
#                            a console screenshot, an infrastructure-as-code path). UNKNOWN volumes are
#                            then reported as ATTESTED instead of failing the run.
#
# Exit status: 0 if every volume is ENCRYPTED or ATTESTED, 1 otherwise.

set -eu

PROJECT="${1:-${COMPOSE_PROJECT_NAME:-vfx-platform}}"
REF="${PROVIDER_ENCRYPTION_REF:-}"
status=0

volumes=$(docker volume ls --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Name}}')

if [ -z "$volumes" ]; then
    echo "No volumes found for compose project '$PROJECT'." >&2
    exit 2
fi

printf '%-34s %-10s %s\n' VOLUME RESULT DETAIL

for volume in $volumes; do
    path=$(docker volume inspect --format '{{.Mountpoint}}' "$volume")
    source=$(findmnt -n -o SOURCE --target "$path" 2>/dev/null || true)
    fstype=$(findmnt -n -o FSTYPE --target "$path" 2>/dev/null || true)
    result=UNKNOWN
    detail="backing: ${source:-unknown} (${fstype:-unknown})"
    [ -d "$path" ] || detail="$detail; $path is not readable here (run as root on the Docker host)"

    if [ "$fstype" = "zfs" ] && command -v zfs >/dev/null 2>&1; then
        encryption=$(zfs get -H -o value encryption "$source" 2>/dev/null || echo off)
        if [ "$encryption" != "off" ] && [ "$encryption" != "-" ]; then
            result=ENCRYPTED
            detail="zfs native encryption: $encryption"
        fi
    elif [ -n "$source" ] && command -v lsblk >/dev/null 2>&1; then
        # -s lists the device and everything beneath it (partitions, LVM, crypt, disk).
        if lsblk -s -n -o TYPE "$source" 2>/dev/null | grep -qx crypt; then
            result=ENCRYPTED
            detail="dm-crypt/LUKS under $source"
        fi
    fi

    if [ "$result" = "UNKNOWN" ]; then
        if [ -n "$REF" ]; then
            result=ATTESTED
            detail="$detail; provider encryption: $REF"
        else
            status=1
        fi
    fi

    printf '%-34s %-10s %s\n' "$volume" "$result" "$detail"
done

if [ "$status" -ne 0 ]; then
    echo >&2
    echo "Some volumes are not shown to be encrypted. Put Docker's data root on a LUKS/ZFS-encrypted" >&2
    echo "volume, or set PROVIDER_ENCRYPTION_REF to the evidence that the provider encrypts them." >&2
fi

exit "$status"
