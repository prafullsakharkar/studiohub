class SerializerContextMixin:
    """
    Common serializer context helpers.
    """

    @property
    def request(self):
        return self.context.get("request")

    @property
    def user(self):
        request = self.request
        return getattr(request, "user", None)

    @property
    def view(self):
        return self.context.get("view")
