"""
Masterdata permissions — canonical dot-notation codes — see ADR-0033 D4.

Checked via global HasPermission (no org context).
"""


class PlatformMasterDataPermissions:
    """Global master-data catalog administration (ADR-0033 D4)."""

    CONFIGURE = "platform.master_data.configure"
