"""
Project notes under ``projects/<project>/notes/`` (docs/review-pipeline RP-2, C-RP-07 to C-RP-13).

Every route needs whole-project access (``external_allowed`` off): a partial (client, vendor, show- or
department-bound) member gets 404, as an unknown project does. The method's code admits the request;
authorship and the task's assignee decide the rest (Q-RP-11, Q-RP-12), in ``ProjectNoteService``.
"""

from __future__ import annotations

from typing import Any, cast

from django.http import Http404
from rest_framework import status as http_status
from rest_framework.response import Response

from apps.production.api.filtersets.project_note import ProjectNoteFilterSet
from apps.production.api.serializers.project_note import (
    ProjectNoteCreateSerializer,
    ProjectNoteDetailSerializer,
    ProjectNoteReplySerializer,
    ProjectNoteSerializer,
    ProjectNoteStatusSerializer,
    ProjectNoteUpdateSerializer,
)
from apps.production.api.views.project_scoped import ProjectScopedAPIView
from apps.production.constants.permissions import NotePermissions, ProjectPermissions
from apps.production.permissions.checks import has_permission_code
from apps.production.selectors.project_note import ProjectNoteSelector, ProjectNoteThreadSelector
from apps.production.services.project_note import UNSET, ProjectNoteService
from apps.production.validators.project_note import (
    legacy_link,
    resolve_links,
    resolve_mentions,
    resolve_task,
)

# What a new thread takes from the request; everything else is the server's (C-RP-07).
CREATE_FIELDS = ("subject", "body", "category", "priority", "tags", "timecode_ref", "frame_number")


def _page_labels(rows) -> dict[str, Any]:
    links = [link for note in rows for link in note.links.all()]
    return {"link_labels": ProjectNoteSelector.link_labels(links)}


class _NoteRoute(ProjectScopedAPIView):
    def _note(self, note_id):
        found = ProjectNoteSelector.note_in_project(
            project=self.project, note_id=note_id, request=self.request
        )
        if found is None:
            raise Http404("Note not found.")
        return found

    def _answer(self, note, *, status=http_status.HTTP_200_OK, detail=False):
        """A note read back through the selector, so its links and counts are the stored ones."""
        fresh = (
            ProjectNoteSelector.threads()
            if note.parent_id is None
            else ProjectNoteSelector.get_queryset()
        ).get(pk=note.pk)
        serializer = ProjectNoteDetailSerializer if detail else ProjectNoteSerializer
        return Response(serializer(fresh, context={"request": self.request}).data, status=status)


class ProjectNotesView(_NoteRoute):
    permission_map = {"get": (ProjectPermissions.VIEW,), "post": (NotePermissions.CREATE,)}

    def get(self, request, *args, **kwargs):
        return self._entity_list(
            selector_cls=ProjectNoteThreadSelector,
            serializer_cls=ProjectNoteSerializer,
            filterset_cls=ProjectNoteFilterSet,
            search_fields=("subject", "body", "entity_code", "entity_name"),
            ordering_fields=("created_at", "priority", "status"),
            ordering=("-created_at",),
            page_context=_page_labels,
        )

    def post(self, request, *args, **kwargs):
        serializer = ProjectNoteCreateSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = cast(dict[str, Any], serializer.validated_data)
        raw_links = legacy_link(data) + list(data.get("links") or [])
        links = resolve_links(raw_links, project=self.project, request=request)
        task = resolve_task(data.get("task_id"), project=self.project, request=request)
        mentions = resolve_mentions(list(data.get("mention_ids") or []), project=self.project)
        note = ProjectNoteService.create_note(
            user=request.user,
            project=self.project,
            links=links,
            task=task,
            mentions=mentions,
            **{name: data[name] for name in CREATE_FIELDS if name in data},
        )
        return self._answer(note, status=http_status.HTTP_201_CREATED)


class ProjectNoteDetailView(_NoteRoute):
    """``GET`` a thread with its replies, ``PATCH`` a note, ``DELETE`` a note (C-RP-10, C-RP-12, C-RP-13)."""

    permission_map = {
        "get": (ProjectPermissions.VIEW,),
        "patch": (NotePermissions.CREATE,),
        "delete": (NotePermissions.CREATE,),
    }

    def get(self, request, *args, note_id=None, **kwargs):
        _note, thread = self._note(note_id)
        return self._answer(thread, detail=True)

    def patch(self, request, *args, note_id=None, **kwargs):
        note, _thread = self._note(note_id)
        may_update = has_permission_code(request, NotePermissions.UPDATE)
        ProjectNoteService.require_editor(user=request.user, note=note, may_update=may_update)
        serializer = ProjectNoteUpdateSerializer(data=request.data or {}, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(cast(dict[str, Any], serializer.validated_data))
        links = None
        if "links" in data:
            links = resolve_links(
                list(data.pop("links") or []), project=self.project, request=request
            )
        task = UNSET
        if "task_id" in data:
            task = resolve_task(data.pop("task_id"), project=self.project, request=request)
        mentions = None
        if "mention_ids" in data:
            mentions = resolve_mentions(list(data.pop("mention_ids") or []), project=self.project)
        note = ProjectNoteService.update_note(
            user=request.user,
            note=note,
            fields=data,
            links=links,
            task=task,
            mentions=mentions,
            may_update=may_update,
        )
        return self._answer(note)

    def delete(self, request, *args, note_id=None, **kwargs):
        note, _thread = self._note(note_id)
        ProjectNoteService.delete_note(
            user=request.user,
            note=note,
            may_delete=has_permission_code(request, NotePermissions.DELETE),
        )
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class ProjectNoteRepliesView(_NoteRoute):
    """``POST`` a reply on the thread (C-RP-11)."""

    permission_map = {"post": (NotePermissions.CREATE,)}

    def post(self, request, *args, note_id=None, **kwargs):
        _note, thread = self._note(note_id)
        serializer = ProjectNoteReplySerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        data = cast(dict[str, Any], serializer.validated_data)
        mentions = resolve_mentions(list(data.get("mention_ids") or []), project=self.project)
        reply = ProjectNoteService.reply(
            user=request.user, thread=thread, body=data["body"], mentions=mentions
        )
        return self._answer(reply, status=http_status.HTTP_201_CREATED)


class ProjectNoteStatusView(_NoteRoute):
    """``POST`` a thread's new status (C-RP-13)."""

    permission_map = {"post": (NotePermissions.CREATE,)}

    def post(self, request, *args, note_id=None, **kwargs):
        note, _thread = self._note(note_id)
        serializer = ProjectNoteStatusSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        note = ProjectNoteService.set_status(
            user=request.user,
            note=note,
            status=cast(dict[str, Any], serializer.validated_data)["status"],
            may_update=has_permission_code(request, NotePermissions.UPDATE),
        )
        return self._answer(note)
