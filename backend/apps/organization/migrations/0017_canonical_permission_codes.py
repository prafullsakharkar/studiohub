"""
ADR-0033 / D3: migrate legacy colon permission codes to canonical dot codes.

Renames ``Permission.code`` values like ``shots:read`` to ``shot.view`` (via
the migration-safe default manager, which is unfiltered on historical models and
therefore also covers soft-deleted rows). When the
canonical row already exists, ``RolePermission`` rows are repointed to it and the
legacy row is deleted so no duplicate grants remain.
"""

from django.db import migrations

LEGACY_TO_CANONICAL = {
    # production
    "projects:read": "project.view",
    "projects:create": "project.create",
    "projects:update": "project.update",
    "projects:delete": "project.delete",
    "sequences:read": "sequence.view",
    "sequences:create": "sequence.create",
    "sequences:update": "sequence.update",
    "sequences:delete": "sequence.delete",
    "shots:read": "shot.view",
    "shots:create": "shot.create",
    "shots:update": "shot.update",
    "shots:delete": "shot.delete",
    "shots:approve": "shot.approve",
    "shows:read": "show.view",
    "shows:create": "show.create",
    "shows:update": "show.update",
    "shows:delete": "show.delete",
    "assets:read": "asset.view",
    "assets:create": "asset.create",
    "assets:update": "asset.update",
    "assets:delete": "asset.delete",
    "tasks:read": "task.view",
    "tasks:create": "task.create",
    "tasks:update": "task.update",
    "tasks:delete": "task.delete",
    "timelogs:read": "timelog.view",
    "timelogs:create": "timelog.create",
    "timelogs:update": "timelog.update",
    "timelogs:delete": "timelog.delete",
    "timelogs:approve": "timelog.approve",
    "versions:read": "version.view",
    "versions:create": "version.create",
    "versions:update": "version.update",
    "versions:delete": "version.delete",
    "versions:publish": "version.publish",
    "reviews:read": "review.view",
    "reviews:create": "review.create",
    "reviews:update": "review.update",
    "reviews:delete": "review.delete",
    "reviews:approve": "review.approve",
    "playlists:read": "playlist.view",
    "playlists:create": "playlist.create",
    "playlists:update": "playlist.update",
    "playlists:delete": "playlist.delete",
    "media:read": "media.view",
    "media:create": "media.create",
    "media:update": "media.update",
    "media:delete": "media.delete",
    "workflows:read": "workflow.view",
    "workflows:create": "workflow.create",
    "workflows:update": "workflow.update",
    "workflows:delete": "workflow.delete",
    # scheduling / publishing / deliveries
    "scheduling:read": "schedule.view",
    "scheduling:create": "schedule.create",
    "scheduling:update": "schedule.update",
    "scheduling:delete": "schedule.delete",
    "publishing:read": "publishing.view",
    "publishing:create": "publishing.create",
    "publishing:update": "publishing.update",
    "publishing:delete": "publishing.delete",
    "deliveries:read": "delivery.view",
    "deliveries:create": "delivery.create",
    "deliveries:update": "delivery.update",
    "deliveries:delete": "delivery.delete",
    # platform / audit
    "reports:read": "report.view",
    "reports:create": "report.create",
    "notifications:read": "notification.view",
    "notifications:update": "notification.update",
    "audit:read": "audit.view",
    "audit:update": "audit.update",
    "tracks:read": "track.view",
    "tracks:create": "track.create",
    "tracks:update": "track.update",
    "tracks:delete": "track.delete",
    # legacy frontend-validated codes
    "settings:update": "settings.update",
    "users:manage": "user.manage",
    "analytics:read": "analytics.view",
}


def migrate_codes(apps, schema_editor):
    Permission = apps.get_model("organization", "Permission")
    RolePermission = apps.get_model("organization", "RolePermission")

    for legacy, canonical in LEGACY_TO_CANONICAL.items():
        legacy_rows = list(Permission.objects.filter(code=legacy))
        if not legacy_rows:
            continue
        canonical_row = (
            Permission.objects.filter(code=canonical).order_by("pk").first()
        )
        for legacy_row in legacy_rows:
            if canonical_row is None:
                legacy_row.code = canonical
                parts = canonical.split(".")
                legacy_row.module = ".".join(parts[:-1]) or legacy_row.module
                legacy_row.action = parts[-1]
                legacy_row.save(update_fields=["code", "module", "action"])
                canonical_row = legacy_row
                continue
            # Canonical row exists: repoint grants then remove the legacy row.
            RolePermission.objects.filter(permission_id=legacy_row.pk).update(
                permission_id=canonical_row.pk
            )
            legacy_row.delete()


def noop(apps, schema_editor):
    # Irreversible by design (codes are canonical going forward).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("organization", "0016_person_organization_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_codes, noop),
    ]
