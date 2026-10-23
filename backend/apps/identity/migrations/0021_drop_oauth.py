# WP 7.7 / 7.8 (decision A7): OAuth is out of scope; its models are removed.
#
# Nothing in the application ever read or wrote these tables, but the drop is
# destructive, so the migration refuses to run if either table holds rows
# (provider client secrets and account tokens would be lost). Export or clear
# them first, then re-run. The reverse recreates the empty tables.

from django.db import migrations


def refuse_if_oauth_rows_exist(apps, schema_editor):
    for name in ("OAuthAccount", "OAuthProvider"):
        if apps.get_model("identity", name).objects.exists():
            raise RuntimeError(
                f"Refusing to drop identity.{name}: the table contains rows. "
                "Export or remove them first, then re-run the migration."
            )


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0020_credential_revocation"),
    ]

    operations = [
        migrations.RunPython(refuse_if_oauth_rows_exist, migrations.RunPython.noop),
        migrations.AlterUniqueTogether(
            name="oauthaccount",
            unique_together=None,
        ),
        migrations.RemoveIndex(
            model_name="oauthaccount",
            name="identity_oa_user_id_139cfb_idx",
        ),
        migrations.RemoveIndex(
            model_name="oauthaccount",
            name="identity_oa_provide_11fa65_idx",
        ),
        migrations.RemoveIndex(
            model_name="oauthaccount",
            name="identity_oa_is_conn_c33f01_idx",
        ),
        migrations.RemoveField(
            model_name="oauthaccount",
            name="created_by",
        ),
        migrations.RemoveField(
            model_name="oauthaccount",
            name="deleted_by",
        ),
        migrations.RemoveField(
            model_name="oauthaccount",
            name="provider",
        ),
        migrations.RemoveField(
            model_name="oauthaccount",
            name="updated_by",
        ),
        migrations.RemoveField(
            model_name="oauthaccount",
            name="user",
        ),
        migrations.DeleteModel(
            name="OAuthProvider",
        ),
        migrations.DeleteModel(
            name="OAuthAccount",
        ),
    ]
