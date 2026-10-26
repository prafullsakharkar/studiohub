"""Fill the review row tables (0040) from the old JSON lists (WP E4, DECISIONS D-30).

Best effort and non-destructive: the JSON columns are not touched, an entry that cannot be read is
printed and skipped. The conversion code is shared with the seeds (``services/review_legacy.py``).
"""

from types import SimpleNamespace

from django.db import migrations


def convert(apps, schema_editor):
    from django.conf import settings

    from apps.production.services.review_legacy import import_review

    Review = apps.get_model("production", "Review")
    models = SimpleNamespace(
        Version=apps.get_model("production", "Version"),
        User=apps.get_model(*settings.AUTH_USER_MODEL.split(".")),
        Item=apps.get_model("production", "ReviewItem"),
        Participant=apps.get_model("production", "ReviewParticipant"),
        Comment=apps.get_model("production", "ReviewComment"),
        Note=apps.get_model("production", "ReviewNote"),
        Annotation=apps.get_model("production", "ReviewAnnotation"),
        Activity=apps.get_model("production", "ReviewActivity"),
    )
    problems: list[str] = []
    for review in Review._base_manager.all().iterator():
        problems += import_review(review, models=models, only_empty=True)
    if problems:
        print(f"\nproduction 0041: {len(problems)} review entr(ies) were not converted:")
        for line in problems[:200]:
            print("  -", line)


class Migration(migrations.Migration):
    dependencies = [("production", "0040_review_parts")]
    operations = [migrations.RunPython(convert, migrations.RunPython.noop)]
