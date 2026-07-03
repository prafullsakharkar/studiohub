from django.contrib.auth import get_user_model

User = get_user_model()


class SuperUserSeeder:

    @classmethod
    def run(cls):

        if User.objects.filter(
            is_superuser=True,
        ).exists():

            return

        User.objects.create_superuser(
            email="admin@example.com",
            password="ChangeMe123!",
            first_name="Studio",
            last_name="Administrator",
        )
