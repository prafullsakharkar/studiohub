"""Fill the playlist entry table (0042) from the old JSON ``entries`` (WP E5, DECISIONS D-31).

Best effort and non-destructive: the JSON column is not touched; an entry naming a version outside the
playlist's project, or that is not an object, is printed and skipped. The conversion code is shared with
the seeds (``services/playlist_legacy.py``).
"""

from types import SimpleNamespace

from django.db import migrations


def convert(apps, schema_editor):
    from apps.production.services.playlist_legacy import import_playlist

    Playlist = apps.get_model("production", "Playlist")
    models = SimpleNamespace(
        Version=apps.get_model("production", "Version"),
        Entry=apps.get_model("production", "PlaylistEntry"),
    )
    problems: list[str] = []
    for playlist in Playlist._base_manager.all().iterator():
        problems += import_playlist(playlist, models=models, only_empty=True)
    if problems:
        print(f"\nproduction 0043: {len(problems)} playlist entr(ies) were not converted:")
        for line in problems[:200]:
            print("  -", line)


class Migration(migrations.Migration):
    dependencies = [("production", "0042_playlist_entries")]
    operations = [migrations.RunPython(convert, migrations.RunPython.noop)]
