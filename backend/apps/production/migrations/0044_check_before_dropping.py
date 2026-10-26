"""Refuse, changing nothing, if dropping the legacy columns (0045) would lose data (plan P12, DECISIONS D-32).

What 0045 drops and what could be lost:

* the six JSON lists of a review and the JSON ``entries`` of a playlist, if an entry never became a row
  (0041 and 0043 print and skip what they cannot read);
* ``Shot.sequence_code`` on a shot that has no ``sequence`` (the text matched no sequence of its project);
* ``is_archived`` on a row that is flagged but not soft-deleted (the flag is no longer read, so the row has
  been live since D-25; dropping it forgets the mark).

Anything else dropped is derived from other data (``Task.logged_hours``, ``Shot.current_version``) or was
already not used (D-15, D-16, D-25). The conversions are run once more first for a review or playlist whose
rows are missing (an old server may have written JSON after 0041 ran). Everything is rolled back on refusal.
"""

from types import SimpleNamespace

from django.conf import settings
from django.db import migrations

REVIEW_LISTS = ("versions", "reviewers", "comments", "notes", "annotations", "activity")
FLAGGED = ("Task", "Asset", "Version", "Playlist", "Workflow")


def check(apps, schema_editor):
    from apps.production.services.playlist_legacy import import_playlist
    from apps.production.services.review_legacy import import_review

    Version = apps.get_model("production", "Version")
    problems: list[str] = []

    review_models = SimpleNamespace(
        Version=Version,
        User=apps.get_model(*settings.AUTH_USER_MODEL.split(".")),
        Item=apps.get_model("production", "ReviewItem"),
        Participant=apps.get_model("production", "ReviewParticipant"),
        Comment=apps.get_model("production", "ReviewComment"),
        Note=apps.get_model("production", "ReviewNote"),
        Annotation=apps.get_model("production", "ReviewAnnotation"),
        Activity=apps.get_model("production", "ReviewActivity"),
    )
    for review in apps.get_model("production", "Review")._base_manager.all().iterator():
        import_review(review, models=review_models, only_empty=True)  # fills what is missing
        problems += import_review(review, models=review_models, dry_run=True)

    playlist_models = SimpleNamespace(
        Version=Version, Entry=apps.get_model("production", "PlaylistEntry")
    )
    for playlist in apps.get_model("production", "Playlist")._base_manager.all().iterator():
        import_playlist(playlist, models=playlist_models, only_empty=True)
        problems += import_playlist(playlist, models=playlist_models, dry_run=True)

    shots = (
        apps.get_model("production", "Shot")
        ._base_manager.filter(sequence__isnull=True)
        .exclude(sequence_code="")
    )
    for shot in shots.iterator():
        problems.append(
            f"shot {shot.code} (project {shot.project_id}): sequence_code {shot.sequence_code!r}"
            " names no sequence of its project"
        )

    for name in FLAGGED:
        flagged = apps.get_model("production", name)._base_manager.filter(
            is_archived=True, is_deleted=False
        )
        for row in flagged.iterator():
            problems.append(
                f"{name.lower()} {getattr(row, 'code', '') or row.pk}: is_archived is set but the row is live"
            )

    if problems:
        listed = "\n  - ".join(problems[:200])
        raise RuntimeError(
            f"production 0044 cannot go on: {len(problems)} row(s) would lose data when 0045 drops the "
            f"legacy columns. Nothing was changed.\n  - {listed}\n"
            "Fix them (or clear the value on those rows: an empty list, an empty sequence_code, or "
            "is_archived = false, or archive the row) and migrate again. See docs/production/DEPLOY.md."
        )


class Migration(migrations.Migration):
    dependencies = [("production", "0043_convert_playlist_entries")]
    operations = [migrations.RunPython(check, migrations.RunPython.noop)]
