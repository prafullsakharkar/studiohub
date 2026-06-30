class DynamicFieldsMixin:
    """
    Supports:

    ?fields=id,name,email
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context.get("request")

        if not request:
            return

        fields = request.query_params.get("fields")

        if not fields:
            return

        allowed = {field.strip() for field in fields.split(",") if field.strip()}

        existing = set(self.fields)

        for field in existing - allowed:
            self.fields.pop(field)
