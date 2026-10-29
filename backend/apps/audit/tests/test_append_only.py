"""Audit rows are append-only in the model and in the database (TPN review TM-011)."""

from __future__ import annotations

import pytest
from django.db import DatabaseError, connection, transaction

from apps.audit.models import APIRequest, AuditLog, ChangeLog
from apps.audit.models.append_only import ImmutableRecordError
from apps.audit.tests.factories import (
    APIRequestFactory,
    AuditLogFactory,
    ChangeLogFactory,
)

FACTORIES = (
    (AuditLog, AuditLogFactory),
    (ChangeLog, ChangeLogFactory),
    (APIRequest, APIRequestFactory),
)

on_postgres = pytest.mark.skipif(
    connection.vendor != "postgresql", reason="the triggers are PostgreSQL's"
)


@pytest.mark.django_db
@pytest.mark.parametrize(("model", "factory"), FACTORIES)
class TestModelGuard:
    def test_a_new_row_saves(self, model, factory):
        assert model.objects.filter(pk=factory().pk).exists()

    def test_save_of_a_recorded_row_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(ImmutableRecordError):
            row.save()

    def test_delete_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(ImmutableRecordError):
            row.delete()
        assert model.objects.filter(pk=row.pk).exists()

    def test_soft_delete_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(ImmutableRecordError):
            row.soft_delete()
        assert model.objects.filter(pk=row.pk).exists()


@on_postgres
@pytest.mark.django_db
@pytest.mark.parametrize(("model", "factory"), FACTORIES)
class TestDatabaseTrigger:
    """The guard also holds for code that skips the model: queryset update and delete, raw SQL."""

    def test_queryset_update_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(DatabaseError), transaction.atomic():
            model.objects.filter(pk=row.pk).update(is_deleted=True)

    def test_queryset_delete_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(DatabaseError), transaction.atomic():
            model.objects.filter(pk=row.pk)._raw_delete(using="default")
        assert model.objects.filter(pk=row.pk).exists()

    def test_raw_sql_delete_is_refused(self, model, factory):
        row = factory()
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(f"DELETE FROM {model._meta.db_table} WHERE id = %s", [row.pk])
        assert model.objects.filter(pk=row.pk).exists()

    def test_delete_is_allowed_inside_the_purge_flag(self, model, factory):
        row = factory()
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("SELECT set_config('studiohub.audit_purge', 'on', true)")
            model.objects.filter(pk=row.pk)._raw_delete(using="default")
        assert not model.objects.filter(pk=row.pk).exists()

    def test_the_purge_flag_does_not_allow_update(self, model, factory):
        row = factory()
        with pytest.raises(DatabaseError), transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('studiohub.audit_purge', 'on', true)")
            model.objects.filter(pk=row.pk).update(is_deleted=True)


@on_postgres
@pytest.mark.django_db
class TestDeletingAUser:
    """The user references are SET_NULL; clearing one is the single update the trigger allows."""

    def test_the_history_survives_with_the_reference_cleared(self):
        from apps.identity.tests.factories import UserFactory

        user = UserFactory.create()
        log = AuditLogFactory(actor=user)
        change = ChangeLogFactory(user=user)
        request = APIRequestFactory(user=user)

        user.hard_delete()

        for row in (log, change, request):
            row.refresh_from_db()
        assert log.actor_id is None
        assert change.user_id is None
        assert request.user_id is None

    def test_clearing_the_reference_together_with_another_change_is_refused(self):
        from apps.identity.tests.factories import UserFactory

        log = AuditLogFactory(actor=UserFactory.create(), description="before")
        with pytest.raises(DatabaseError), transaction.atomic():
            AuditLog.objects.filter(pk=log.pk).update(actor=None, description="after")

    def test_pointing_the_reference_at_someone_else_is_refused(self):
        from apps.identity.tests.factories import UserFactory

        log = AuditLogFactory(actor=UserFactory.create())
        with pytest.raises(DatabaseError), transaction.atomic():
            AuditLog.objects.filter(pk=log.pk).update(actor=UserFactory.create())
