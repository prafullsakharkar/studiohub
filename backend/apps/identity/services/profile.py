from apps.identity.models import Profile


class ProfileService:

    model = Profile

    @classmethod
    def create(
        cls,
        *,
        user=None,
        **validated_data,
    ):
        validated_data.setdefault(
            "display_name",
            f"{validated_data.get('first_name', '')} "
            f"{validated_data.get('last_name', '')}".strip()
            or (user.email if user else "User"),
        )

        return Profile.objects.create(
            user=user,
            **validated_data,
        )

    @classmethod
    def update_profile(
        cls,
        profile,
        **data,
    ):

        for key, value in data.items():
            setattr(profile, key, value)

        profile.full_clean()

        profile.save()

        return profile

    @classmethod
    def update(
        cls,
        instance,
        **validated_data,
    ):
        return cls.update_profile(
            instance,
            **validated_data,
        )

    @classmethod
    def delete(
        cls,
        instance,
        **kwargs,
    ):
        instance.delete()
