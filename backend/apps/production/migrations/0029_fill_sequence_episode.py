"""
File each sequence of an episodic project under the episode its shots already use.

A sequence is filled only when all of its shots (soft-deleted ones included, so a restore
stays consistent) name the same single episode. A sequence with no shots, with shots in
several episodes, or in a standard project is left with ``episode = NULL``; nothing is
guessed and nothing fails (DECISIONS D-12). Shots are not touched. List what is left with
``manage.py report_production_data``.

Reverse: nothing to undo; reversing 0028 drops the column.
"""

from django.db import migrations

from apps.core.logging.logger import get_logger

logger = get_logger("production")


def fill_sequence_episode(apps, schema_editor):
    Sequence = apps.get_model("production", "Sequence")
    Shot = apps.get_model("production", "Shot")
    filled = 0
    undecided = 0
    for sequence in Sequence._base_manager.filter(
        episode__isnull=True, project__workflow_type="episodic"
    ).iterator():
        episodes = set(
            Shot._base_manager.filter(sequence_id=sequence.pk).values_list("episode_id", flat=True)
        )
        if len(episodes) == 1 and None not in episodes:
            Sequence._base_manager.filter(pk=sequence.pk).update(episode_id=episodes.pop())
            filled += 1
        else:
            undecided += 1
    logger.info("sequence_episode_backfill", filled=filled, undecided=undecided)
    if undecided:
        logger.warning(
            "sequence_episode_undecided",
            sequences=undecided,
            hint="run `manage.py report_production_data` to list them",
        )


class Migration(migrations.Migration):
    dependencies = [("production", "0028_sequence_episode")]

    operations = [migrations.RunPython(fill_sequence_episode, migrations.RunPython.noop)]
