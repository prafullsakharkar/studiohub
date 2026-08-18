Metadata — Domain vs Metadata, Ownership & Provenance

Distinguish domain data vs metadata

- Domain data: canonical fields that model core business concepts (e.g., Asset.name, Shot.code, Task.status). These are authoritative and should be modeled as first-class columns.
- Metadata: flexible attributes that annotate domain entities (e.g., ColorSpace, Lens, SceneDescription). Metadata is secondary and should be modeled to support flexibility while retaining queryability and governance.

Metadata model guidance

- Prefer typed columns for core fields; use JSONB for flexible metadata when required.
- For frequently queried metadata, consider typed value tables or partial projection columns to enable indexing and efficient filtering.
- Each metadata value must record provenance: source (user|pipeline|import|AI), source_id, created_at, created_by, and content_hash.

Metadata lifecycle

- Define metadata templates and profiles (see metadata-templates.md).
- Support metadata versioning: when schemas change, keep older data readable and record migration decisions.
- Maintain audit trail for metadata changes and store provenance for derived fields.

Validation & quality

- Apply server-side validation per custom field definitions (required, regex, min/max, dependencies).
- Track metadata quality (missing/invalid/deprecated) and expose completeness metrics (per-entity or per-profile).

Storage patterns

- JSONB for flexible sets, typed tables for heavy query patterns, hybrid when both flexibility and queryability needed.
- Avoid EAV unless justified; prefer explicit typed value tables or JSONB with maintained projection fields for indexing.

Searchability

- Only metadata marked searchable should be indexed. Maintain explicit search field capability flags for governance and cost control.

