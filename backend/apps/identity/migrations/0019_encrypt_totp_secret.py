# WP 6.3: TOTP secrets are encrypted at rest.
#
# The column type is unchanged (varchar); only the stored form changes, so the
# schema step is a no-op. The data step encrypts every existing plaintext
# secret (reverse decrypts them back). It works on raw SQL so it does not
# depend on the model field, is idempotent (values already carrying the
# ``enc:v1:`` prefix are skipped), and needs MFA_ENCRYPTION_KEY only if there
# is at least one secret to convert: with the key missing it fails closed
# rather than leaving plaintext behind.

from django.db import migrations

import apps.identity.models.fields
from apps.identity import crypto

TABLE = "identity_user_mfa"


def encrypt_existing(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f"SELECT id, totp_secret FROM {TABLE} "
            "WHERE totp_secret <> '' AND totp_secret NOT LIKE %s",
            [crypto.PREFIX + "%"],
        )

        for pk, secret in cursor.fetchall():
            cursor.execute(
                f"UPDATE {TABLE} SET totp_secret = %s WHERE id = %s",
                [crypto.encrypt(secret), pk],
            )


def decrypt_existing(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            f"SELECT id, totp_secret FROM {TABLE} WHERE totp_secret LIKE %s",
            [crypto.PREFIX + "%"],
        )

        for pk, stored in cursor.fetchall():
            cursor.execute(
                f"UPDATE {TABLE} SET totp_secret = %s WHERE id = %s",
                [crypto.decrypt(stored), pk],
            )


class Migration(migrations.Migration):
    dependencies = [
        ("identity", "0018_mfa_lifecycle"),
    ]

    operations = [
        migrations.AlterField(
            model_name="usermfa",
            name="totp_secret",
            field=apps.identity.models.fields.EncryptedSecretField(
                blank=True,
                max_length=255,
            ),
        ),
        migrations.RunPython(encrypt_existing, decrypt_existing),
    ]
