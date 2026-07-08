class APIKeyPermissions:
    """
    API Key permissions.
    """

    MODULE = "identity.api_key"

    VIEW = f"{MODULE}.view"

    CREATE = f"{MODULE}.create"

    UPDATE = f"{MODULE}.update"

    DELETE = f"{MODULE}.delete"

    MANAGE = f"{MODULE}.manage"

    REVOKE = f"{MODULE}.revoke"

    ACTIVATE = f"{MODULE}.activate"

    REGENERATE = f"{MODULE}.regenerate"
