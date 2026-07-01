from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDefinition:

    code: str

    name: str

    module: str

    action: str

    description: str = ""
