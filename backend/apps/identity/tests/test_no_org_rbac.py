from apps.identity.models import ApiKey, Role


def test_rbac_models_have_no_org_field():
    assert "organization" not in [f.name for f in Role._meta.get_fields()]
    assert "organization" not in [f.name for f in ApiKey._meta.get_fields()]
