# StudioHub Entity Relationships & Navigation Graph

## 1. Relational Topology
StudioHub models the complete, multi-dimensional relational web of modern visual effects studios.

```
Organization (Multi-Tenant Root)
├── Clients (N:M with Projects)
├── Vendors (N:M with Projects & Tasks)
├── People (N:M with Projects, Teams, Offices)
├── Departments (N:M with Projects, 1:N Teams)
├── Teams (N:M with Projects, N:M People)
├── Offices (N:M with Projects, 1:N People)
└── Projects (Central Production Master)
    ├── Sequences (1:N with Shots)
    ├── Shots (1:N with Tasks, 1:N with Versions)
    ├── Assets (1:N with Tasks, 1:N with Versions)
    ├── Tasks (Assigned to Person / Vendor)
    ├── Versions (1:N with Reviews)
    └── Reviews (1:N ReviewItems with Version/Shot)
```

---

## 2. Cardinality Matrix

| Source Entity | Target Entity | Cardinality | Relational Semantics |
|:---|:---|:---|:---|
| `Organization` | `All Entities` | `1 : N` | Root multi-tenant boundary. All entities belong to an organization. |
| `Client` | `Project` | `N : M` | Clients commission projects; joint ventures can have multiple co-clients. |
| `Vendor` | `Project` | `N : M` | Outsourcing facilities contract on multiple shows simultaneously. |
| `Person` | `Team` | `N : M` | Artists belong to primary and cross-functional task force squads. |
| `Person` | `Project` | `N : M` | Crew members are cast onto multiple active film shows. |
| `Department` | `Team` | `1 : N` | Discipline departments supervise multiple production squads. |
| `Department` | `Project` | `N : M` | Departments deliver work across all active studio productions. |
| `Office` | `Project` | `N : M` | Global facilities collaborate across timezones on distributed shows. |
| `Project` | `Shot` | `1 : N` | Master project owns all production VFX cut shots. |
| `Project` | `Asset` | `1 : N` | Master project owns all 3D environment, character, and vehicle assets. |
| `Project` | `Task` | `1 : N` | Master project owns all bid discipline work packages. |
| `Shot` | `Task` | `1 : N` | Each shot has discrete department tasks (Roto, Matchmove, Comp, FX). |
| `Shot` | `Version` | `1 : N` | Artists iterate publishes (v001, v002, v003) for each shot. |
| `Version` | `Review` | `N : M` | Published versions are screened across multiple dailies review sessions. |

---

## 3. Bidirectional Navigation Paths

StudioHub guarantees that no production module is isolated:
1. **Client → Project → Shot**: Inspecting a client displays all commissioned shows; clicking a show opens its shot sequencer.
2. **Vendor → Project → Task**: Inspecting a vendor reveals assigned outsource bid tasks; clicking a task reveals its parent shot.
3. **Person → Team → Project → Shot**: Viewing an artist highlights their squad, assigned projects, and active shot assignments.
4. **Project → Shot → Version → Review**: Selecting a shot in the sequencer displays its version stack and review screening logs.
5. **Review → Version → Shot → Task**: Reviewers playback a version, add frame annotations, and directly update the underlying task status.
