Taxonomy & Tags — Governance, Normalization & Use

Taxonomy (Controlled Vocabulary)

- Purpose: provide structured, hierarchical classification (e.g., Asset Type, Shot Type, Department).
- Features: support parent/child relationships, ordering, status, synonyms, and aliases.
- Ownership: organization-scoped or project-scoped taxonomies with managed steward roles.

Tags (Flexible Labels)

- Purpose: lightweight, user-driven labeling for discovery and collaboration.
- Features: user tags, system tags, AI-suggested tags, tag normalization (lowercasing, stemming), aliases, merges.
- Governance: permission controls on who can create, rename, merge, delete tags.

Normalization & dedupe

- Introduce normalization pipeline: lowercase, trim, collapse whitespace, remove punctuation by default; allow organization-specific normalization rules and synonyms.
- Provide admin tools for merging and aliasing tags and recording canonical forms.

Indexing

- Taxonomy nodes are canonical and should be indexed as structured facets.
- Tags are indexed as flexible facets; support popularity and recent use counts for suggestions.

UI considerations

- Tag suggestion UX with normalization preview and conflict warnings.
- Taxonomy editor for stewards with visualization for hierarchies and bulk import/export.

