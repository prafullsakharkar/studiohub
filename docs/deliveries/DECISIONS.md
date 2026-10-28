# Deliveries decisions

Cross-app decisions (Q1-Q4, Q6-Q12) are in `docs/delivery-pipeline/DECISIONS.md`. Status: **ANSWERED**, **ASSUMED** ("your call"), **OPEN**, **DEFERRED**.

| Q | Question | Answer | Date | Status | Affects |
|---|---|---|---|---|---|
| Q1 | What does a delivery item reference? | A published `production.Version` (as today), plus a snapshot of its registered files from Publishing. | 2026-10-27 | ASSUMED | Phase 6 |
| Q4 | How deliveries reach clients | Tracking only; no public download links. The plain-text `passcode` is fixed regardless. | 2026-10-27 | ASSUMED | Phase 7 |
| Q5 | Scope | **Now:** race-free package numbering; only published items; snapshot at send; transition map; separation of duties; QC records; revision lineage. **Later:** delivery specs and templates; client feedback loop; notifications. **Not:** executing transfers. | 2026-10-27 | ASSUMED | Phases 6-8 |
| Q16 | Internal approval and client answer | **A.** Both; internal sign-off (new `Signed Off` state, `sign-off` action) with separation of duties; `approve` / `reject` keep meaning the client's answer. | 2026-10-27 | ASSUMED | DOM-DLV-02, 07 |
| Q17 | Passcode | **A.** Encrypted, `delivery.view_secret`, audited reads. | 2026-10-27 | ASSUMED | DOM-DLV-09 |
| Q18 | Frontend body keys | **A.** `reason` and `notes` accepted beside the backend names. | 2026-10-27 | ASSUMED | API-DLV-11 to 13 |
| Q23 | Audit target types | **A.** `delivery` target added. | 2026-10-27 | ASSUMED | Phase 6 |
| Q24 | On-delete rules | **A.** Items, versions, packages, project, client `PROTECT`. | 2026-10-27 | ASSUMED | Phase 6 |
| Q26 | Immutability and corrections (`revise`) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-05 |
| Q27 | Transition map, 409 | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-02 |
| Q28 | Separation of duties | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-07 |
| Q29 | Snapshot and revocation | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-03, 05, 08 |
| Q30 | Links and notifications | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | SEC-DLV-06 |
| Q33 | Stored vs derived (totals, `is_archived`, destination text) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-01 |
| Q34 | Codes and role matrix | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | `PLAN.md` §6 |
| Q35 | Sensitive fields, passcode key | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-DLV-09 |
| Q36 | Bulk contract (`bulk-cancel`) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | API-DLV-17 |
| Q38 | Compatibility (integer item id) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | API-DLV-05 |

Full text of Q25-Q38: `docs/delivery-pipeline/DECISIONS.md`. Phase 1 analysis: `ANALYSIS.md`. Design: `CONTRACTS.md`, `PLAN.md`.
