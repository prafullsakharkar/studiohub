from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.identity.api_keys.hashing import PREFIX_V2
from apps.identity.choices import SecurityEventType
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.services.security_event import SecurityEventService


class Command(BaseCommand):
    help = (
        "List the live API keys and personal access tokens still stored with the old digest "
        "(sha256 of SECRET_KEY:token). They upgrade only when used, so a rarely used one stays on "
        "the old form. Once none is left, set API_KEY_ACCEPT_LEGACY_HASH=false. --revoke revokes "
        "them so the switch can be turned off now; their owners reissue."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--revoke",
            action="store_true",
            help="Revoke every credential listed.",
        )

    def handle(self, *args, **options):
        found = 0

        for model, field, label in (
            (ApiKey, "hashed_key", "api key"),
            (PersonalAccessToken, "hashed_token", "personal access token"),
        ):
            legacy = (
                model.objects.filter(is_active=True, revoked_at__isnull=True)
                .exclude(**{f"{field}__startswith": PREFIX_V2})
                .order_by("created_at")
            )

            for credential in legacy:
                found += 1
                owner = credential.principal
                self.stdout.write(
                    f"{label}  {credential.prefix}  {credential.name!r}  "
                    f"owner={getattr(owner, 'email', '-')}  "
                    f"last used={credential.last_used_at or 'never'}"
                )

                if options["revoke"]:
                    self._revoke(credential, owner, label)

        verb = "revoked" if options["revoke"] else "found"
        self.stdout.write(f"{verb}: {found}")

    @staticmethod
    def _revoke(credential, owner, label):
        credential.is_active = False
        credential.revoked_at = timezone.now()
        credential.save(update_fields=["is_active", "revoked_at", "updated_at"])

        if owner is not None:
            SecurityEventService.create(
                user=owner,
                event_type=SecurityEventType.API_KEY_REVOKED,
                description=f"{label.capitalize()} revoked: stored with the legacy digest.",
                metadata={
                    "credential_id": str(credential.pk),
                    "prefix": credential.prefix,
                    "reason": "legacy_digest",
                },
            )
