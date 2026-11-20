# Shot grades as a .ccc file, for DI, editorial and vendors

A project's shot grades, their ASC CDLs, leave StudioHub as one `ColorCorrectionCollection` (`.ccc`), the file grading
and conform tools read (review-pipeline RP-27; contract C-RP-62). People use **Export grades…** on the Shots page; a
tool uses the route below, for example to hand the DI the studio's current grades for a reel. The file is the reverse
of [Import grades](shot-grades-import.md): importing an exported file changes nothing.

## Before you start

- The tool authenticates with a **personal access token** of an account that reads the project's shots (`shot.view`).
  Give the token the scopes `project.view` and `shot.view`. The file holds the shots its owner reads, as the Shots list
  does: a show-bound account gets its show's shots, a vendor member the shots of their vendor's tasks, a client member
  none.
- Only shots with a grade are written; archived shots never are.

## The call

```
GET /api/v1/projects/{project_id}/grades/export/
GET /api/v1/projects/{project_id}/grades/export/?sequence_id={sequence_id}
Authorization: Token <personal access token>
```

The answer is the file itself:

```
200 OK
Content-Type: application/xml; charset=utf-8
Content-Disposition: attachment; filename="<project code>_grades.ccc"
Cache-Control: no-store

<?xml version='1.0' encoding='utf-8'?>
<ColorCorrectionCollection xmlns="urn:ASC:CDL:v1.01">
  <ColorCorrection id="ALPHA_SH010">
    <Description>reel1.ccc</Description>
    <SOPNode>
      <Slope>1.100000 1.000000 0.900000</Slope>
      <Offset>0.010000 0.000000 -0.010000</Offset>
      <Power>1.000000 1.000000 1.050000</Power>
    </SOPNode>
    <SatNode>
      <Saturation>0.900000</Saturation>
    </SatNode>
  </ColorCorrection>
</ColorCorrectionCollection>
```

- One `ColorCorrection` per graded shot, ordered by code; its `id` is the shot's code. `Description` names the file
  the grade was imported from, and is left out for a typed grade.
- Values are written with six places, as stored, so a round trip through the import changes nothing.
- `sequence_id` narrows the file to one sequence. An unknown or malformed id, or one from another project, gives an
  empty collection (200), never a 400. A project with no graded shot also answers an empty collection; note that the
  import refuses an empty file ("The file holds no ColorCorrection.").

## Errors

| Status | When |
|---|---|
| 403 | the account lacks `shot.view` (or the token's scopes do) |
| 404 | the project does not exist, or the account is not a member of it |

## Audit

Each file is an `export` row in the audit log on the project: the account, the client address, the file name, the
sequence (or none) and the number of shots. A refused call writes no row.
