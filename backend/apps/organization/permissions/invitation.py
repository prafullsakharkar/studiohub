from apps.organization.models import Invitation


class InvitationPermissions:
    """Permissions for Invitation model."""

    @staticmethod
    def can_view(user, invitation=None):
        """Check if user can view invitations."""
        if user.is_superuser:
            return True
        if invitation:
            return user.memberships.filter(
                organization=invitation.organization, status="active"
            ).exists()
        return False

    @staticmethod
    def can_create(user, organization=None):
        """Check if user can create invitations."""
        if user.is_superuser:
            return True
        if organization:
            return user.memberships.filter(
                organization=organization, status="active"
            ).exists()
        return False

    @staticmethod
    def can_update(user, invitation=None):
        """Check if user can update invitations."""
        if user.is_superuser:
            return True
        if invitation:
            return user.memberships.filter(
                organization=invitation.organization, status="active"
            ).exists()
        return False

    @staticmethod
    def can_delete(user, invitation=None):
        """Check if user can delete invitations."""
        if user.is_superuser:
            return True
        if invitation:
            return user.memberships.filter(
                organization=invitation.organization, status="active"
            ).exists()
        return False

    @staticmethod
    def can_accept(user, invitation=None):
        """Check if user can accept invitations."""
        if invitation:
            return invitation.email == user.email
        return False

    @staticmethod
    def can_decline(user, invitation=None):
        """Check if user can decline invitations."""
        if invitation:
            return invitation.email == user.email
        return False
