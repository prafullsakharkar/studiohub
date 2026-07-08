class PersonalAccessTokenPermissions:
    """
    Personal Access Token permissions.
    """

    MODULE = "identity.personal_access_token"

    VIEW = f"{MODULE}.view"

    CREATE = f"{MODULE}.create"

    UPDATE = f"{MODULE}.update"

    DELETE = f"{MODULE}.delete"

    REVOKE = f"{MODULE}.revoke"

    ACTIVATE = f"{MODULE}.activate"
