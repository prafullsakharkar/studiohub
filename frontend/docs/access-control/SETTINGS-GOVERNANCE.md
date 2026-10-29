# Settings Governance (N5)

Two settings systems coexist for different needs. They are NOT duplicates —
each owns a distinct key space.

- Typed `OrganizationSettings` (`organization_organization_settings` table):
  fixed, well-known keys ONLY (locale, timezone, pipeline defaults, feature
  flags). Adding a key requires a migration + serializer + frontend type —
  deliberate by design.
- EAV `OrganizationSetting` (`organization_settings` table +
  `SettingDefinition`): custom/extensible per-org keys. No migration needed;
  whoever defines the key documents it here.

Rule: if a setting needs validation, filtering, or a dedicated UI control,
it belongs in the typed model. If it is free-form or experimental, it goes
to EAV. Never both for the same key.

Note: the `domainPermissions` "capabilities" wording (e.g. in
`core/access/domainPermissions.ts`) is description prose about what a
permission allows, not a separate authorization concept — no rename needed.
