"""Regression: nested holiday create must accept UI-complete payloads.

Frontend sends organization/code/name/date/holiday_type/is_paid without
work_calendar. The serializer must accept those fields (not read-only) and
the service must default work_calendar to the org's default calendar.
"""

from __future__ import annotations

import pytest

from apps.organization.tests.factories import OrganizationFactory, WorkCalendarFactory
from apps.organization.tests.rbac_helpers import grant_all_known_codes


@pytest.mark.django_db
def test_nested_holiday_create_defaults_work_calendar(staff_client, staff_user):
    from apps.organization.models import Holiday

    org = OrganizationFactory.create()
    default_cal = WorkCalendarFactory.create(
        organization=org, is_default=True, code="WC-DEF"
    )
    grant_all_known_codes(staff_user, org)

    response = staff_client.post(
        f"/api/organizations/{org.id}/holidays/",
        {
            "organization": str(org.id),
            "code": "HOL-XMAS26",
            "name": "Xmas Test",
            "date": "2026-12-25",
            "holiday_type": "public",
            "is_paid": True,
        },
        format="json",
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )

    assert response.status_code == 201, response.content[:500]
    data = response.json()
    assert data["code"] == "HOL-XMAS26"
    assert data["work_calendar"] == str(default_cal.id)
    assert Holiday.objects.filter(code="HOL-XMAS26").exists()
