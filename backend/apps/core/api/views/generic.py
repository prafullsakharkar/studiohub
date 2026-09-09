from rest_framework.generics import GenericAPIView


class BaseGenericAPIView(
    GenericAPIView,  # pyright: ignore[reportMissingTypeArgument]
):
    pass
