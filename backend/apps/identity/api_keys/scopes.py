from enum import StrEnum


class APIKeyScope(StrEnum):
    READ = "read"

    WRITE = "write"

    DELETE = "delete"

    ADMIN = "admin"

    USER = "user"

    ORGANIZATION = "organization"

    PROJECT = "project"

    SHOT = "shot"

    PIPELINE = "pipeline"

    RENDER = "render"
