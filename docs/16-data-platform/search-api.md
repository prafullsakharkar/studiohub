Search API — Spec sketch

Unified search endpoint

POST /api/search

Request
{
  "q": "hero dragon shot",
  "entity_types": ["shot","asset","version"],
  "filters": {
    "project_id": "uuid",
    "status": ["review","approved"],
    "custom_fields.priority": {"gte": 3}
  },
  "facets": ["project_id","asset_type","tag"],
  "sort": {"by": "relevance"},
  "page": {"cursor": "...", "limit": 50},
  "highlight": true
}

Response
{
  "cursor": "...",
  "total_estimate": 12345,
  "results": [
    {"entity_type":"shot","id":"uuid","score":12.3,"highlight":"...","projection":{...}},
    {"entity_type":"asset","id":"uuid","score":8.2,"projection":{...}}
  ],
  "facets": {"project_id":[{"value":"uuid","count":3}]}
}

Notes

- Use cursor-based pagination.
- Filters must be validated server-side.
- Results must be post-filtered to enforce permissions where needed.
- Provide a separate suggestion/autocomplete endpoint for entity suggestions.
- Consider semantics parameter to choose hybrid/full-text/semantic retrieval.
