class BrandingService:

    @classmethod
    def update_logo(
        cls,
        organization,
        logo,
    ):
        organization.logo = logo
        organization.save(update_fields=["logo"])
        return organization

    @classmethod
    def update_colors(
        cls,
        organization,
        *,
        primary_color,
        secondary_color,
    ):
        organization.primary_color = primary_color
        organization.secondary_color = secondary_color
        organization.save(
            update_fields=[
                "primary_color",
                "secondary_color",
            ]
        )

        return organization
