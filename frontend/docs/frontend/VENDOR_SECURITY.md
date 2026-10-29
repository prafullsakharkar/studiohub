# Vendor Isolation & Outsourcing Security

StudioHub provides strict multi-tenant boundary isolation for third-party vendor studios and external outsourcing partners.

---

## 1. Vendor Boundary Guarantees

1. **Strict Vendor Scoping**: Vendor users (`scope: 'VENDOR'`) can *only* discover, view, and query tasks, shots, and versions explicitly linked to their `vendor_id`.
2. **Zero Internal Data Leakage**:
   - Internal artist names and internal user profiles are masked or hidden.
   - Internal studio budget, artist day rates, internal bids, and profit margins are stripped at the API layer.
   - Internal review playlists and unapproved internal notes are completely excluded from response payloads.
3. **No Cross-Vendor Contamination**: Vendor A cannot see tasks, deliveries, or status of Vendor B under any condition.
4. **Administrative Route Barriers**: All `/settings`, `/organizations/:id/access`, `/billing`, and studio-level admin routes return HTTP `403 Forbidden` for vendor credentials.

---

## 2. Vendor Workflow Isolation

```text
Studio Production ──(Assigns Task to Vendor A)──► Vendor A Workspace
                                                      │
                                             Vendor Artist works
                                                      │
                                             Uploads Vendor Version
                                                      │
                                             Vendor Lead reviews
                                                      │
Studio Supervisor ◄──(Submits to Studio)────── Submits Delivery
```

---

## 3. MSW Enforcement

Every API handler querying `/api/v1/tasks/` or `/api/organizations/:orgId/projects/:projId/tasks` applies:

```typescript
if (userScope === 'VENDOR') {
  filteredList = filteredList.filter(item => item.vendor_id === user.vendor_id);
}
```
Any direct request to a non-vendor entity returns `404 Not Found` or `403 Forbidden`.
