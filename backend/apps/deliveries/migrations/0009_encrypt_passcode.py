"""
Delivery passcodes are stored encrypted (docs/deliveries/CONTRACTS.md DOM-DLV-09, SEC-DLV-02).

Widens the column (ciphertext is longer than the 64 characters a passcode may have) and encrypts
every existing passcode in place with ``DELIVERY_SECRET_KEY``. Deleted deliveries are included.

Refuses, changing nothing, when passcodes exist and no key is configured: the message says how
many, never what they are. Reverse decrypts them again (it needs the same key) and narrows the
column. The read-only query D1 in docs/delivery-pipeline/ANALYSIS.md section 8 counts the passcodes
beforehand.
"""

from django.db import migrations, models

from apps.deliveries import passcode


def encrypt_existing(apps, schema_editor):
    Package = apps.get_model("deliveries", "DeliveryPackage")
    rows = list(Package._base_manager.exclude(passcode="").values_list("pk", "passcode"))
    plain = [(pk, value) for pk, value in rows if not passcode.is_encrypted(value)]
    if not plain:
        return
    from django.conf import settings

    if not getattr(settings, "DELIVERY_SECRET_KEYS", ()):
        raise RuntimeError(
            f"deliveries 0009 stopped, nothing was changed: {len(plain)} deliveries have a "
            "passcode and DELIVERY_SECRET_KEY is not set. Set a Fernet key, then migrate again."
        )
    for pk, value in plain:
        Package._base_manager.filter(pk=pk).update(passcode=passcode.encrypt(value))


def decrypt_existing(apps, schema_editor):
    Package = apps.get_model("deliveries", "DeliveryPackage")
    for pk, value in list(Package._base_manager.exclude(passcode="").values_list("pk", "passcode")):
        if passcode.is_encrypted(value):
            Package._base_manager.filter(pk=pk).update(passcode=passcode.decrypt(value))


class Migration(migrations.Migration):
    dependencies = [
        ("deliveries", "0008_workflow"),
    ]

    operations = [
        migrations.AlterField(
            model_name="deliverypackage",
            name="passcode",
            field=models.CharField(
                blank=True,
                help_text=(
                    "Security passcode for client access, stored encrypted "
                    "(apps.deliveries.passcode). Never read this column directly."
                ),
                max_length=255,
            ),
        ),
        migrations.RunPython(encrypt_existing, decrypt_existing),
    ]
