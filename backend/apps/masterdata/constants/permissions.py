"""
Masterdata permissions — canonical dot-notation codes (ADR-0033 D4,
docs/masterdata/DECISIONS.md D9).

Checked via global HasPermission (no org context). Reads need authentication
only; every write needs the matching ``manage`` code, and hard delete also
needs ``HARD_DELETE``.
"""


class PlatformMasterDataPermissions:
    """Legacy single write grant, kept as an alias for one release (D9)."""

    CONFIGURE = "platform.master_data.configure"


class MasterdataPermissions:
    CATALOG_MANAGE = "masterdata.catalog.manage"
    DIRECTORY_MANAGE = "masterdata.directory.manage"
    HARD_DELETE = "masterdata.hard_delete"
    # Personal data in people, positions, clients, vendors and contacts (H1).
    PERSON_VIEW_SENSITIVE = "masterdata.person.view_sensitive"
    # Contract values and the client billed total (DECISIONS D11). Deliberately
    # separate from PERSON_VIEW_SENSITIVE: finance and people data are different
    # audiences.
    CLIENT_VIEW_FINANCIAL = "masterdata.client.view_financial"


# New code -> legacy code that still satisfies it during the alias period.
LEGACY_ALIASES = {
    MasterdataPermissions.CATALOG_MANAGE: PlatformMasterDataPermissions.CONFIGURE,
    MasterdataPermissions.DIRECTORY_MANAGE: PlatformMasterDataPermissions.CONFIGURE,
}
