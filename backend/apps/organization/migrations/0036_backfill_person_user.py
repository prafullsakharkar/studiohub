"""Backfill Person.user by email match (N1 consolidation).

Exactly-one-match wins (case-insensitive): zero matches and blank emails
stay unlinked. ``identity.User.email`` is unique so genuine ambiguity is
impossible, but the guard stays defensive. Idempotent — rerunnable and
reports counts.
"""

from django.db import migrations


def backfill_person_users(apps, schema_editor):
    Person = apps.get_model("organization", "Person")
    User = apps.get_model("identity", "User")
    linked, unmatched = 0, 0
    for person in (
        Person.objects.filter(user__isnull=True).exclude(email="").only("id", "email")
    ):
        matches = list(
            User.objects.filter(email__iexact=person.email).values_list("id", flat=True)
        )
        if len(matches) == 1:
            person.user_id = matches[0]
            person.save(update_fields=["user"])
            linked += 1
        else:
            unmatched += 1
    print(f"person_user backfill: linked={linked} unmatched={unmatched}")


class Migration(migrations.Migration):

    dependencies = [
        (
            "organization",
            "0035_person_user",
        ),
    ]

    operations = [
        migrations.RunPython(backfill_person_users, migrations.RunPython.noop),
    ]
