"""
A directory with older TLS, the certificate still checked (CR-41, ADR-0039 decision 4).

The handshake tests run the real client code against a local TLS server shaped like the studio's
OpenLDAP: TLS 1.2 with only a static-RSA cipher (``AES256-GCM-SHA384``) and a self-signed
certificate that names ``ldap`` and not the address it is reached at.
"""

from __future__ import annotations

import contextlib
import datetime
import socket
import ssl
import threading
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from django.core.cache import cache
from ldap3 import Connection
from ldap3.core.exceptions import LDAPException

from apps.identity.models import DirectoryConfiguration, SecurityEvent
from apps.identity.services.directory.client import LEGACY_CIPHERS, DirectoryClient
from apps.identity.tests.directory_helpers import (
    DIRECTORY,
    SERVICE_DN,
    SERVICE_PASSWORD,
    TEST_CONNECTION,
    FakeDirectory,
    as_user,
    give_role,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]


def _self_signed(name: str) -> tuple[bytes, bytes]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.datetime.now(datetime.UTC)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=30))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]), critical=False)
        .sign(key, hashes.SHA256())
    )
    key_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    return certificate.public_bytes(serialization.Encoding.PEM), key_pem


@pytest.fixture(scope="module")
def certificates():
    """The directory's own certificate (``CN=ldap``), and an unrelated one."""
    return {"ldap": _self_signed("ldap"), "other": _self_signed("other")}


@pytest.fixture(scope="module")
def old_tls_directory(certificates, tmp_path_factory):
    """A TLS server like the studio's: TLS 1.2, AES256-GCM-SHA384 only; answers the handshake."""
    folder: Path = tmp_path_factory.mktemp("tls")
    cert_pem, key_pem = certificates["ldap"]
    (folder / "cert.pem").write_bytes(cert_pem)
    (folder / "key.pem").write_bytes(key_pem)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.maximum_version = ssl.TLSVersion.TLSv1_2
    context.set_ciphers("AES256-GCM-SHA384")
    context.load_cert_chain(folder / "cert.pem", folder / "key.pem")

    listener = socket.create_server(("127.0.0.1", 0))
    listener.settimeout(0.2)
    stop = threading.Event()

    def serve():
        while not stop.is_set():
            try:
                raw, _ = listener.accept()
            except TimeoutError:
                continue
            raw.settimeout(5)
            try:
                with context.wrap_socket(raw, server_side=True):
                    pass
            except (ssl.SSLError, OSError):
                pass

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    yield f"ldaps://127.0.0.1:{listener.getsockname()[1]}"
    stop.set()
    thread.join(timeout=2)
    listener.close()


def _config(uri: str, **fields) -> DirectoryConfiguration:
    return DirectoryConfiguration(server_uri=uri, timeout_seconds=5, **fields)


def _handshake(config: DirectoryConfiguration) -> str:
    """Open a connection the way the client does: "ok", or why it was refused."""
    connection = Connection(
        DirectoryClient(config, bind_password="").server(),
        receive_timeout=5,
        raise_exceptions=False,
    )
    try:
        connection.open()
    except LDAPException as exc:
        return str(exc)
    finally:
        with contextlib.suppress(LDAPException):
            connection.unbind()
    return "ok"


class TestTheTlsArguments:
    def test_the_defaults_are_unchanged(self):
        tls = DirectoryClient(_config("ldaps://ldap.studio.test"), bind_password="").server().tls

        assert tls.validate == ssl.CERT_REQUIRED
        assert tls.ciphers is None
        assert tls.valid_names is None

    def test_older_ciphers_change_only_the_cipher_list(self):
        tls = (
            DirectoryClient(
                _config("ldaps://ldap.studio.test", tls_allow_legacy_ciphers=True),
                bind_password="",
            )
            .server()
            .tls
        )

        assert tls.ciphers == LEGACY_CIPHERS
        assert tls.validate == ssl.CERT_REQUIRED
        assert tls.valid_names is None

    def test_the_older_ciphers_add_only_static_rsa_aes_gcm(self):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.set_ciphers(LEGACY_CIPHERS)
        default = {c["name"] for c in ssl.create_default_context().get_ciphers()}

        added = {c["name"] for c in context.get_ciphers()} - default

        assert added == {"AES256-GCM-SHA384", "AES128-GCM-SHA256"}

    def test_a_certificate_name_changes_only_the_names_matched(self):
        tls = (
            DirectoryClient(
                _config("ldaps://192.168.1.17", tls_server_name="ldap"), bind_password=""
            )
            .server()
            .tls
        )

        assert tls.valid_names == ["ldap"]
        assert tls.validate == ssl.CERT_REQUIRED
        assert tls.ciphers is None


class TestAgainstADirectoryWithOlderTls:
    def test_the_defaults_cannot_connect(self, old_tls_directory, certificates):
        trusted = certificates["ldap"][0].decode()

        result = _handshake(_config(old_tls_directory, ca_certificate=trusted))

        assert "HANDSHAKE_FAILURE" in result

    def test_older_ciphers_alone_are_refused_on_the_name(self, old_tls_directory, certificates):
        config = _config(
            old_tls_directory,
            ca_certificate=certificates["ldap"][0].decode(),
            tls_allow_legacy_ciphers=True,
        )

        assert "doesn't match any name" in _handshake(config)

    def test_older_ciphers_and_the_certificate_name_connect(self, old_tls_directory, certificates):
        config = _config(
            old_tls_directory,
            ca_certificate=certificates["ldap"][0].decode(),
            tls_allow_legacy_ciphers=True,
            tls_server_name="ldap",
        )

        assert _handshake(config) == "ok"

    def test_a_wrong_certificate_name_is_still_refused(self, old_tls_directory, certificates):
        config = _config(
            old_tls_directory,
            ca_certificate=certificates["ldap"][0].decode(),
            tls_allow_legacy_ciphers=True,
            tls_server_name="other",
        )

        assert "doesn't match any name" in _handshake(config)

    @pytest.mark.parametrize("trust", ["none", "other"])
    def test_an_untrusted_certificate_is_still_refused(
        self, old_tls_directory, certificates, trust
    ):
        config = _config(
            old_tls_directory,
            ca_certificate="" if trust == "none" else certificates["other"][0].decode(),
            tls_allow_legacy_ciphers=True,
            tls_server_name="ldap",
        )

        assert "CERTIFICATE_VERIFY_FAILED" in _handshake(config)


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def admin():
    user = UserFactory.create(is_email_verified=True)
    give_role(user, "platform-admin")
    return as_user(user)


@pytest.fixture
def directory(monkeypatch):
    fake = FakeDirectory()
    fake.install(monkeypatch)
    return fake


def _connection(**extra):
    return {
        # ldaps: the in-memory fake directory cannot do StartTLS.
        "server_uri": "ldaps://ldap.studio.test",
        "bind_dn": SERVICE_DN,
        "bind_password": SERVICE_PASSWORD,
        "user_search_base": "ou=people,dc=studio,dc=test",
        **extra,
    }


class TestTheSettings:
    def test_they_are_saved_and_shown(self, admin):
        response = admin.patch(
            DIRECTORY,
            _connection(tls_allow_legacy_ciphers=True, tls_server_name="ldap"),
            format="json",
        )

        assert response.status_code == 200, response.json()
        body = admin.get(DIRECTORY).json()
        assert body["tls_allow_legacy_ciphers"] is True
        assert body["tls_server_name"] == "ldap"

    def test_they_start_off(self, admin):
        body = admin.get(DIRECTORY).json()

        assert body["tls_allow_legacy_ciphers"] is False
        assert body["tls_server_name"] == ""

    @pytest.mark.parametrize(
        "name", ["*", "*.studio.com", "ldap://ldap", "ldap:389", "ld ap", "-ldap", "ldap/x"]
    )
    def test_a_name_that_is_not_one_host_is_refused(self, admin, name):
        response = admin.patch(DIRECTORY, {"tls_server_name": name}, format="json")

        assert response.status_code == 400
        assert "tls_server_name" in response.json()
        assert DirectoryConfiguration.objects.get().tls_server_name == ""

    @pytest.mark.parametrize("name", ["ldap", "ldap.intra.studio.com", "192.168.1.17", "fd00::17"])
    def test_a_host_name_or_address_is_accepted(self, admin, name):
        response = admin.patch(DIRECTORY, {"tls_server_name": name}, format="json")

        assert response.status_code == 200, response.json()

    @pytest.mark.parametrize(
        "change", [{"tls_allow_legacy_ciphers": True}, {"tls_server_name": "ldap"}]
    )
    def test_changing_either_needs_a_new_connection_test(self, admin, directory, change):
        admin.patch(DIRECTORY, _connection(), format="json")
        assert admin.post(TEST_CONNECTION).json()["ok"] is True
        assert DirectoryConfiguration.objects.get().last_tested_at is not None

        admin.patch(DIRECTORY, change, format="json")

        assert DirectoryConfiguration.objects.get().last_tested_at is None
        assert admin.patch(DIRECTORY, {"enabled": True}, format="json").status_code == 400

    def test_the_change_is_audited(self, admin):
        admin.patch(
            DIRECTORY, {"tls_allow_legacy_ciphers": True, "tls_server_name": "ldap"}, format="json"
        )

        event = SecurityEvent.objects.filter(metadata__area="directory").latest("occurred_at")
        assert set(event.metadata["fields"]) == {"tls_allow_legacy_ciphers", "tls_server_name"}
