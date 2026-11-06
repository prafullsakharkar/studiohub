"""
The episodic rules of a project (D-12, CR-47).

A project is episodic when ``workflow_type == "episodic"``; only then does it have episodes. These
checks are shared by the single and the bulk writes of episodes, sequences and shots, so a bulk
item is held to exactly what a single create or update is held to. Each one rewrites the resolved
references into ``data`` in place and raises a field-keyed ``ValidationError`` to refuse; an
episode or sequence of another project reads like one that does not exist.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ValidationError

from apps.production.constants import ProjectWorkflowType

EPISODES_NOT_USED = "Episodes are not used on standard projects."


def is_episodic(project: Any) -> bool:
    """Whether ``project`` has episodes (``workflow_type`` is the only authority, not ``type``)."""
    return project is not None and project.workflow_type == ProjectWorkflowType.EPISODIC


def require_episodic_project(project: Any) -> None:
    """Episodes are created on episodic projects only (400 on ``project``, as before)."""
    if project is not None and not is_episodic(project):
        raise ValidationError({"project": "Episodes can only be created on episodic projects."})


def _given(raw: Any) -> bool:
    from apps.production.models import Episode

    return isinstance(raw, Episode) or bool(str(raw or "").strip())


def apply_sequence_episode_rule(data: dict[str, Any], *, project: Any, creating: bool) -> None:
    """
    The episode of a sequence (D-12).

    * Episodic project: a new sequence needs an episode of that project. An existing sequence
      keeps what it has (older rows may have none) but cannot be cleared.
    * Standard project: no episode; sending one is a 400, sending an empty value is fine.
    """
    from apps.production.selectors.episode import EpisodeSelector

    if project is None:
        return
    supplied = "episode" in data
    raw = data.get("episode") if supplied else None

    if not is_episodic(project):
        if _given(raw):
            raise ValidationError({"episode_id": [EPISODES_NOT_USED]})
        if supplied:
            data["episode"] = None
        return

    required = {"episode_id": ["An episode is required for sequences on episodic projects."]}
    if not supplied:
        if creating:
            raise ValidationError(required)
        return
    if not _given(raw):
        raise ValidationError(required)
    episode = EpisodeSelector.resolve_in_project(project, raw)
    if episode is None:
        raise ValidationError({"episode_id": ["Unknown episode."]})
    data["episode"] = episode


def apply_shot_episode_chain(data: dict[str, Any], *, project: Any, instance: Any = None) -> None:
    """
    The episode/sequence chain of a shot (D-12).

    * ``episode_id`` / ``sequence_id`` arrive as raw references (id or code); both resolve inside
      the project, and an unknown or foreign one is a 400 on its field.
    * A shot follows the episode of its sequence when the sequence has one: an episode that
      differs is a 400, an omitted one is taken from the sequence.
    * Episodic projects require an episode. Standard projects take none (CR-47): a shot cannot be
      given one there, which keeps the chain consistent with ``apply_sequence_episode_rule``.

    ``sequence_ref`` never reaches ``save()``.
    """
    from apps.production.selectors.episode import EpisodeSelector
    from apps.production.selectors.sequence import SequenceSelector

    episode_supplied = "episode" in data
    raw_episode = data.get("episode") if episode_supplied else None
    raw_sequence = data.pop("sequence_ref", None)
    sequence_supplied = raw_sequence is not None

    if project is None:
        return

    sequence = instance.sequence if instance is not None else None
    if sequence_supplied:
        text = str(raw_sequence or "").strip()
        if text:
            sequence = SequenceSelector.resolve_in_project(project, text)
            if sequence is None:
                raise ValidationError(
                    {"sequence_id": ["Unknown sequence for the selected project."]}
                )
            data["sequence"] = sequence
        else:
            sequence = None
            data["sequence"] = None

    if not is_episodic(project):
        if episode_supplied and _given(raw_episode):
            raise ValidationError({"episode_id": [EPISODES_NOT_USED]})
        if episode_supplied:
            data["episode"] = None
        return

    episode = None
    if episode_supplied:
        if _given(raw_episode):
            episode = EpisodeSelector.resolve_in_project(project, raw_episode)
            if episode is None:
                raise ValidationError({"episode_id": ["Unknown episode."]})
        data["episode"] = episode
    elif instance is not None:
        episode = instance.episode

    # A sequence with no episode (older rows) leaves the shot's own episode as it is.
    if sequence is not None and sequence.episode_id is not None:
        if episode_supplied and episode is not None and episode.pk != sequence.episode_id:
            raise ValidationError(
                {"episode_id": ["The episode must be the episode of the sequence."]}
            )
        if episode is None or sequence_supplied:
            data["episode"] = episode = sequence.episode

    if episode is None:
        raise ValidationError(
            {"episode_id": ["An episode is required for shots on episodic projects."]}
        )
