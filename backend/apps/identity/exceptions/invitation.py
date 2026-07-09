from .base import IdentityException


class InvitationExpired(
    IdentityException,
):
    default_code = "invitation_expired"

    default_message = "Invitation has expired."


class InvitationAlreadyAccepted(
    IdentityException,
):
    default_code = "invitation_already_accepted"

    default_message = "Invitation already accepted."
