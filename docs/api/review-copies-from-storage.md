# Review copies from studio storage, for render-farm and publish tools

A version still in review can have its review copy made from a render already on studio storage, without uploading it
(review-pipeline RP-18; contracts C-RP-47 to C-RP-49; ADR-0043). Nothing on the server does this on its own: a render
farm's post-job script or a publish tool calls the route.

## Before you start

- The studio's servers read the storage root: its code is in `PUBLISHING_STORAGE_MOUNTS`, and the media worker mounts
  its directory read-only.
- The project names its **review folder**: a project editor sets *Review folder: storage root* and *folder on the root*
  on the project's edit page (`review_source_root`, `review_source_folder` on `PATCH /api/v1/projects/{id}/`).
- The tool authenticates with a **personal access token** of the artist, or of an account that may change the
  version's review copy (`version.update`, or `version.create` as the version's artist). Create one under *Settings →
  Account → Tokens* (`/settings/account/tokens`). A token's scopes are permission codes: give it `version.view` and
  `version.update` (or `version.create`); a token with no scopes has its owner's full rights.

## The call

```
POST /api/v1/versions/{version_id}/review-media/from-storage/
Authorization: Token <personal access token>
Content-Type: application/json

{"path": "sh010/comp/v003/sh010_comp_v003.%04d.exr", "first_frame": 1001, "last_frame": 1120}
```

- `path` is **relative to the project's review folder**, `/`-separated, without `..`. A movie or still is named as it
  is; a sequence with a frame pattern (`%04d` or `####`) and both `first_frame` and `last_frame`.
- `color_space` (optional) names the render's colour space in the studio's OpenColorIO config; without it an EXR takes
  the project's colour space.
- **202** with the queued review-media row. Poll `GET /api/v1/versions/{id}/` (`review_media_job`) to follow it.
- **400** on `path`, `first_frame`, `last_frame` or `color_space`, one sentence each; they never name a directory.
  **403** without the rights, **404** for a version out of reach, **409** `review_media_busy` while another copy of the
  version is being made (try again later) or `review_media_disabled`.

The worker reads the render when the job runs. If the folder has changed by then, or a file is missing, unreadable or
a link out of the folder, the job fails with `render_unreadable`.

## Example (Python)

```python
import os, requests

resp = requests.post(
    f"{os.environ['STUDIOHUB_URL']}/api/v1/versions/{version_id}/review-media/from-storage/",
    headers={"Authorization": f"Token {os.environ['STUDIOHUB_TOKEN']}"},
    json={"path": render_path, "first_frame": first, "last_frame": last},
    timeout=30,
)
if resp.status_code == 409 and resp.json()["error"]["code"] == "review_media_busy":
    ...  # another copy is being made: retry later
resp.raise_for_status()
```
