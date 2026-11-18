# Shot grades from the client's CDL files, for DI and pipeline tools

A shot's grade, its ASC CDL, is applied to the colour-managed review copies of its versions while the project's
*Apply shot grades* switch is on (review-pipeline RP-20; contracts C-RP-52 to C-RP-54; the RP-20 note in ADR-0041).
Grades are typed on the shot's edit page, imported on the Shots page with **Import grades…**, or sent by a tool with
the route below, for example when the DI hands over a new collection for a reel.

## Before you start

- The tool authenticates with a **personal access token** of an account that may update the project's shots
  (`shot.update`). Give the token the scopes `project.view` and `shot.update`; a token with no scopes has its owner's
  full rights. Only the shots its owner may update are matched: a show-bound account matches its show's shots only.
- Shot codes and correction ids must agree, ignoring case: `SH010` matches the shot `SH010`, and also `ALPHA_SH010` on
  the project `ALPHA` (and the other way round). Nothing else is matched: `SH01` never matches `SH010`.

## The call

```
POST /api/v1/projects/{project_id}/grades/import/
Authorization: Token <personal access token>
Content-Type: multipart/form-data

file=@reel1.ccc        a .cc, .ccc or .cdl file, at most 1 MiB and 2,000 corrections
dry_run=true           the default: answers what would change and writes nothing
```

Send it once with `dry_run=true` and check the answer, then again with `dry_run=false` to write. Without a dry run every
matched shot is written in one transaction, or none.

```json
{
  "dry_run": true, "file_name": "reel1.ccc", "corrections": 4, "applied": 0,
  "matched": [{"id": "SH010", "shot": {"id": "…", "code": "ALPHA_SH010"},
               "old": null, "new": {"slope": [1.1, 1.0, 0.9], "offset": [0.01, 0.0, -0.01],
                                    "power": [1.0, 1.0, 1.05], "saturation": 0.9}}],
  "unchanged": [{"id": "SH020", "shot": {"id": "…", "code": "ALPHA_SH020"}}],
  "unmatched": ["SH999"],
  "invalid": [{"id": "SH030", "field": "saturation", "message": "saturation must be from 0 up to 10."}]
}
```

- **unmatched**: no shot the account may update has that code.
- **invalid**: a value out of range (slope 0 to 10, offset −1 to 1, power above 0 up to 10, saturation 0 to 10), a
  correction without an id, or a second correction for the same shot.
- **400 on `file`**: not a `.cc`, `.ccc` or `.cdl` file, larger than 1 MiB, not XML, no `ColorCorrection`, or a file that
  declares a document type (CDL files never need one; such a file is refused unread).

## What happens next

Nothing is remade on its own (Q-RP-96). The project's review-copies notice (the Versions tab) counts the copies made with
another grade, and **Remake** makes them again with the new grades: movies and stills from their upload, sequences while
their frames are kept, copies from studio storage while the file can still be read. The review movie panel says which
grade a copy was made with, and from which file.
