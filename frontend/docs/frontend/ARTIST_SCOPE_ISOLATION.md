# Artist Scope Isolation & Assignment Security

StudioHub ensures individual artists operate with focused, least-privilege visibility across production assets and shots.

---

## 1. Assignment Scoping (`ASSIGNED` / `OWN`)

1. **Assigned Scope Enforcement**:
   - Artists with `scope: 'ASSIGNED'` only receive records where `assignee_id === user.id` or `assigned_artist_id === user.id`.
   - General project shots outside of the artist's assigned scope are omitted from list queries and return `403 Forbidden` on direct retrieval.
2. **Department Scope (`DEPARTMENT`)**:
   - Department Leads and Senior Artists can inspect all tasks and assets within their active department (e.g., Modeling, FX, Comp) while keeping cross-department unassigned assets compartmentalized.
3. **Workflow Action Limitations**:
   - Artists can update progress (`task.update_progress`), transition tasks from `Ready` to `In Progress` to `Pending Review`, and publish WIP versions.
   - Destructive operations (`shot.delete`, `project.delete`) and executive approvals (`shot.approve`, `version.final_approve`) are strictly denied at the API gateway layer.
