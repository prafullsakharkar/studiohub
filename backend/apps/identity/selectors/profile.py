from apps.identity.models import Profile


class ProfileSelector:

    @staticmethod
    def get(pk):
        return Profile.objects.select_related("user").get(pk=pk)

    @staticmethod
    def list():
        return Profile.objects.select_related("user")
