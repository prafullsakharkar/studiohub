"""
The directory (OpenLDAP) client: search with the service account, then bind as the user
(ADR-0039 decision 4).

The typed password is only ever bound with, never read or compared here. An empty password is
refused before any bind: RFC 4513 section 5.1.2 makes a DN with an empty password an
*unauthenticated* bind, which a server may report as a success.
"""

from __future__ import annotations

import logging
import ssl
from dataclasses import dataclass
from typing import Any

from ldap3 import NONE, SUBTREE, SYNC, Connection, Server, Tls
from ldap3.core.exceptions import LDAPException
from ldap3.utils.conv import escape_filter_chars

logger = logging.getLogger(__name__)

USERNAME_MAX_LENGTH = 255


class DirectoryUnavailable(Exception):
    """The directory could not be asked: no connection, a timeout, or the service bind failed."""


class DirectoryAmbiguous(Exception):
    """The search found more than one entry for one username."""


@dataclass(frozen=True)
class DirectoryEntry:
    dn: str
    subject: str
    username: str
    email: str
    first_name: str
    last_name: str
    display_name: str

    def public(self) -> dict[str, str]:
        """What the "test a username" check shows (the attributes that would be copied)."""
        return {
            "dn": self.dn,
            "subject": self.subject,
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "display_name": self.display_name,
        }


def _first(value: Any) -> str:
    if isinstance(value, (list, tuple)):
        value = value[0] if value else ""
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    return "" if value is None else str(value).strip()


class DirectoryClient:
    """
    One directory, as the configuration describes it.

    ``bind_password`` is the decrypted service password; the caller decrypts it so this module
    needs no key. ``client_strategy`` and ``server`` exist for the tests (ldap3's in-memory mock).
    """

    client_strategy: Any = SYNC

    def __init__(self, config, *, bind_password: str, server: Server | None = None) -> None:
        self.config = config
        self.bind_password = bind_password
        self._server = server

    # ------------------------------------------------------------------
    # Connections
    # ------------------------------------------------------------------

    def server(self) -> Server:
        if self._server is not None:
            return self._server
        config = self.config
        tls = Tls(
            validate=ssl.CERT_REQUIRED,
            version=ssl.PROTOCOL_TLS_CLIENT,
            ca_certs_data=config.ca_certificate or None,
        )
        return Server(
            config.server_uri,
            use_ssl=config.server_uri.lower().startswith("ldaps://"),
            tls=tls,
            get_info=NONE,
            connect_timeout=config.timeout_seconds,
        )

    def _bind(self, user: str, password: str) -> tuple[Connection, bool]:
        """Open, secure and bind one connection; raises DirectoryUnavailable on a network fault."""
        connection = Connection(
            self.server(),
            user=user,
            password=password,
            auto_bind=False,
            client_strategy=self.client_strategy,
            receive_timeout=self.config.timeout_seconds,
            read_only=True,
            raise_exceptions=False,
        )
        try:
            connection.open()
            if self.config.start_tls and not connection.start_tls():
                raise DirectoryUnavailable("StartTLS was refused")
            return connection, bool(connection.bind())
        except LDAPException as exc:
            raise DirectoryUnavailable(type(exc).__name__) from None

    def _service_connection(self) -> Connection:
        connection, bound = self._bind(self.config.bind_dn, self.bind_password)
        if not bound:
            result = connection.result or {}
            connection.unbind()
            logger.warning(
                "directory: the service account bind failed [result %s]", result.get("result")
            )
            raise DirectoryUnavailable("service bind failed")
        return connection

    # ------------------------------------------------------------------
    # Lookups
    # ------------------------------------------------------------------

    def _filter_for(self, username: str) -> str:
        return self.config.user_filter.replace("{username}", escape_filter_chars(username))

    def _attributes(self) -> list[str]:
        config = self.config
        return [
            config.attr_subject,
            config.attr_username,
            config.attr_email,
            config.attr_first_name,
            config.attr_last_name,
            config.attr_display_name,
        ]

    def _entry(self, item: dict[str, Any]) -> DirectoryEntry:
        config = self.config
        attributes = item.get("attributes") or {}

        def read(name: str) -> str:
            return _first(attributes.get(name))

        return DirectoryEntry(
            dn=item.get("dn", ""),
            subject=read(config.attr_subject),
            username=read(config.attr_username),
            email=read(config.attr_email).lower(),
            first_name=read(config.attr_first_name),
            last_name=read(config.attr_last_name),
            display_name=read(config.attr_display_name),
        )

    def find(self, username: str) -> DirectoryEntry | None:
        """The one entry for ``username``, ``None`` when there is none."""
        username = (username or "").strip()
        if not username or len(username) > USERNAME_MAX_LENGTH:
            return None
        connection = self._service_connection()
        try:
            try:
                connection.search(
                    self.config.user_search_base,
                    self._filter_for(username),
                    search_scope=SUBTREE,
                    attributes=self._attributes(),
                    size_limit=2,
                )
            except LDAPException as exc:
                raise DirectoryUnavailable(type(exc).__name__) from None
            found = [r for r in (connection.response or []) if r.get("type") == "searchResEntry"]
        finally:
            connection.unbind()
        if len(found) > 1:
            raise DirectoryAmbiguous(username)
        if not found:
            return None
        entry = self._entry(found[0])
        if not entry.subject:
            logger.warning(
                "directory: the entry has no %s attribute; it cannot be used",
                self.config.attr_subject,
            )
            return None
        return entry

    def authenticate(self, username: str, password: str) -> DirectoryEntry | None:
        """
        The entry, when ``password`` binds as it; ``None`` for no entry or a refused bind.

        Raises ``DirectoryUnavailable`` when the directory cannot be asked, so the caller can fail
        closed without counting it against the person.
        """
        if not password:
            return None
        entry = self.find(username)
        if entry is None:
            return None
        connection, bound = self._bind(entry.dn, password)
        connection.unbind()
        return entry if bound else None

    def test_connection(self) -> None:
        """Bind with the service account and read the search base; raises DirectoryUnavailable."""
        from ldap3 import BASE

        connection = self._service_connection()
        try:
            ok = connection.search(
                self.config.user_search_base,
                "(objectClass=*)",
                search_scope=BASE,
                attributes=[],
            )
        except LDAPException as exc:
            raise DirectoryUnavailable(type(exc).__name__) from None
        finally:
            connection.unbind()
        if not ok:
            raise DirectoryUnavailable("the search base cannot be read")
