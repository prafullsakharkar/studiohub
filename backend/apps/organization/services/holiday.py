from apps.core.services.business import BusinessService
from apps.organization.events import (
    HolidayActivated,
    HolidayArchived,
    HolidayCreated,
    HolidayDeactivated,
    HolidayDeleted,
    HolidayRestored,
    HolidayUpdated,
)
from apps.organization.models import Holiday
from apps.organization.validators.holiday import HolidayValidator


class HolidayService(BusinessService):

    model = Holiday

    validator_class = HolidayValidator

    @classmethod
    def before_create(
        cls,
        **validated_data,
    ):
        # A holiday must belong to a calendar; default to the org's
        # default work calendar when the client sends none (the workspace
        # UI does not pick one). Provision the default calendar on demand
        # when the org has none yet, so holiday create never 409s.
        if not validated_data.get("work_calendar"):
            org = validated_data.get("organization")
            if org is not None:
                from apps.organization.models import WorkCalendar

                default = (
                    WorkCalendar.objects.filter(
                        organization=org, is_default=True, is_deleted=False
                    ).first()
                    or WorkCalendar.objects.filter(
                        organization=org, is_deleted=False
                    ).first()
                )
                if default is None:
                    default, _ = WorkCalendar.objects.get_or_create(
                        organization=org,
                        code="WC-DEF",
                        defaults={
                            "name": "Default Work Calendar",
                            "timezone": "UTC",
                            "is_default": True,
                        },
                    )
                validated_data["work_calendar"] = default
        return validated_data

    event_map = {
        "create": HolidayCreated,
        "update": HolidayUpdated,
        "delete": HolidayDeleted,
        "restore": HolidayRestored,
        "archive": HolidayArchived,
        "activate": HolidayActivated,
        "deactivate": HolidayDeactivated,
    }
