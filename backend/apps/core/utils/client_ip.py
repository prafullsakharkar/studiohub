"""
Canonical client-IP resolution (SEC-IP-01, SEC-IP-02, decision A14).

``REMOTE_ADDR`` is the client address unless the direct peer is a configured
trusted proxy (``settings.TRUSTED_PROXY_IPS``: IPs and/or CIDR ranges). Only
then is ``X-Forwarded-For`` consulted, and it is read right to left: each
trusted proxy appends the address it received the request from, so the first
hop that is *not* a trusted proxy is the real client. Anything a client put to
the left of that is attacker-controlled and ignored.

Fail closed: a malformed header or an untrusted peer yields ``REMOTE_ADDR``.
"""

from __future__ import annotations

import ipaddress
from functools import lru_cache
from typing import Any

from django.conf import settings

MAX_IP_LENGTH = 45

_Network = ipaddress.IPv4Network | ipaddress.IPv6Network


@lru_cache(maxsize=8)
def _parse_networks(entries: tuple[str, ...]) -> tuple[_Network, ...]:
    networks: list[_Network] = []

    for entry in entries:
        value = (entry or "").strip()
        if not value:
            continue
        # A bare address is a /32 or /128; ``strict=False`` tolerates host bits.
        networks.append(ipaddress.ip_network(value, strict=False))

    return tuple(networks)


def trusted_proxy_networks() -> tuple[_Network, ...]:
    return _parse_networks(tuple(getattr(settings, "TRUSTED_PROXY_IPS", ()) or ()))


def _parse(value: str):
    try:
        address = ipaddress.ip_address(value.strip())
    except ValueError:
        return None

    mapped = getattr(address, "ipv4_mapped", None)

    return mapped or address


def _is_trusted(address, networks) -> bool:
    return any(address in network for network in networks if network.version == address.version)


def client_ip_from_meta(meta: Any) -> str | None:
    """Resolve the client IP from a WSGI ``META`` mapping."""

    if not meta:
        return None

    remote_raw = (meta.get("REMOTE_ADDR") or "").strip()
    remote = remote_raw[:MAX_IP_LENGTH] or None

    networks = trusted_proxy_networks()
    peer = _parse(remote_raw) if remote_raw else None

    if not networks or peer is None or not _is_trusted(peer, networks):
        return remote

    hops = [hop for hop in (meta.get("HTTP_X_FORWARDED_FOR") or "").split(",") if hop.strip()]

    if not hops:
        return remote

    parsed = [_parse(hop) for hop in hops]

    if any(address is None for address in parsed):
        return remote

    for address in reversed(parsed):
        if not _is_trusted(address, networks):
            return str(address)[:MAX_IP_LENGTH]

    # Every hop is trusted infrastructure: the request originated inside it.
    return str(parsed[0])[:MAX_IP_LENGTH]


def get_client_ip(request: Any) -> str | None:
    """Resolve the client IP for an HttpRequest or DRF Request."""

    meta = getattr(request, "META", None) or getattr(
        getattr(request, "_request", None), "META", None
    )

    return client_ip_from_meta(meta)
