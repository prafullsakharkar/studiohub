"""The new endpoints appear in the OpenAPI schema with their real request bodies."""

from __future__ import annotations

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db


@pytest.fixture(scope="module")
def schema(django_db_blocker):
    with django_db_blocker.unblock():
        return SchemaGenerator().get_schema(request=None, public=True)


def _body(schema, path, method="post"):
    content = schema["paths"][path][method]["requestBody"]["content"]["application/json"]
    return content["schema"]["$ref"].rsplit("/", 1)[-1]


@pytest.mark.parametrize(
    ("path", "component"),
    [
        ("/api/v1/publishing/files/", "RegisterFile"),
        ("/api/v1/publishing/files/bulk-register/", "BulkRegister"),
        ("/api/v1/publishing/files/{uuid}/deprecate/", "Deprecate"),
        ("/api/v1/publishing/files/{uuid}/restore/", "Restore"),
        ("/api/v1/publishing/files/{uuid}/revoke/", "Revoke"),
    ],
)
def test_file_actions_declare_their_bodies(schema, path, component):
    assert _body(schema, path) == component


def test_a_registered_file_has_no_write_endpoints(schema):
    detail = schema["paths"]["/api/v1/publishing/files/{uuid}/"]
    assert set(detail) - {"parameters"} == {"get"}


def test_storage_roots_are_listed(schema):
    assert "/api/v1/publishing/storage-roots/" in schema["paths"]
    assert "/api/v1/publishing/storage-roots/{uuid}/" in schema["paths"]


def test_the_registration_body_has_the_documented_fields(schema):
    properties = schema["components"]["schemas"]["RegisterFile"]["properties"]
    assert set(properties) == {
        "version_id", "storage_root", "relative_path", "role", "file_type", "size_bytes",
        "sha256", "frame_start", "frame_end", "export_job_id",
    }  # fmt: skip
