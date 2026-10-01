"""Uniqueness for org-owned group/position codes.

Clone-master needs database-level dedupe: same code must not exist twice
inside one organization. Global uniqueness on Group.code is dropped — two
orgs may legitimately clone the same master code.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0032_seed_global_master_positions"),
    ]

    operations = [
        migrations.AlterField(
            model_name="group",
            name="code",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=100,
            ),
        ),
        migrations.AddConstraint(
            model_name="group",
            constraint=models.UniqueConstraint(
                fields=["organization", "code"],
                name="uq_group_org_code",
            ),
        ),
        migrations.AddConstraint(
            model_name="position",
            constraint=models.UniqueConstraint(
                fields=["organization", "code"],
                name="uq_position_org_code",
            ),
        ),
    ]
