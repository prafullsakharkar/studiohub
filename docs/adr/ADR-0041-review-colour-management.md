# ADR-0041: Colour-managing review copies with OpenColorIO, through a baked LUT applied by the distribution's ffmpeg

Status: **accepted** (planned 2026-11-17 as review-pipeline RP-15; approved by the owner the same day: "go ahead", every
recommendation of Q-RP-68 to Q-RP-72) · Amends: [ADR-0040](ADR-0040-review-media-processing.md) (how a copy's picture
is made) · Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-15), `docs/review-pipeline/CONTRACTS.md` (C-RP-39,
C-RP-40) · Evidence: `docs/review-pipeline/rp-15-verification.md`

## Context

RP-12 made review copies of EXR frames with one fixed rule: ffmpeg's decoder turns linear light straight into the sRGB
curve (`apply_trc iec61966_2_1`). There is no tone mapping and no gamut conversion, so anything above 1.0 clips and
ACEScg primaries are shown as if they were Rec.709. Measured against the ACES 2.0 SDR view, mid grey shows as 118 of 255
instead of 89. Across a test image the mean difference is 40 code values and the largest 227. A supervisor reviewing comp in
the app saw a brighter, clipped, more saturated picture than in Nuke or RV.

Studios describe their colour pipeline in an OpenColorIO config. FFmpeg gained an `ocio` filter in 8.1. The media worker
runs Debian stable's ffmpeg 7.1.5 (ADR-0040), which has no such filter. Building ffmpeg ourselves would put a compiler and
a hand-built media stack into the worker image.

OpenColorIO 2.6 is published on PyPI as `opencolorio` (BSD-3-Clause), with manylinux wheels for the Python the images run.
It carries the ASWF built-in configs (`ocio://…`), so no config file has to be shipped.

## Decisions

1. **OpenColorIO is a Python dependency, not part of ffmpeg.** `opencolorio>=2.6.0,<3` is installed in every backend image.
   The web process uses it to check names on project writes and to list the options (`GET review-media/colour/`). The media
   worker uses it to bake the transform. The package's version range may move, but the default config is pinned by name, so
   upgrading the package does not change how copies look.
2. **The config is a setting.** `REVIEW_MEDIA_OCIO_CONFIG` names a built-in config (`ocio://…`) or a `config.ocio` path the
   web and the media worker can both read. The default is `ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6` (ACES 2.0).
   `config/env.py` reads it, as every setting. `manage.py check` warns (`production.W002`) when review media is on and the
   config cannot be loaded. A copy names the config by its own name (or its file's name), never by a server path.
3. **The transform is baked into a 3D LUT and applied by ffmpeg's `lut3d`.**
   - OpenColorIO's `Baker` writes a cineSpace LUT for (input colour space → the sRGB display, view, look): a 65³ cube.
     For scene-linear inputs it adds a 4,096-point shaper through the config's `color_timing` role (ACEScct), so the cube
     spans the HDR range evenly.
   - ffmpeg applies it with `lut3d=…:interp=tetrahedral` on the float picture. This comes first in every picture made from
     the source (the copy, its thumbnail, filmstrip and still), and `apply_trc` is not used.
   - Burn-ins (RP-12) are drawn after it, so their text keeps its colour.
   - Measured against OpenColorIO's own processor: ordinary pixels are within 1.75 code values (mean 0.15), below what an
     8-bit 4:2:0 copy shows. Extreme, near-pure HDR greens differ by up to 27 where ACES 2.0's gamut compression bends
     hardest. The encode costs about 15% more time.
4. **A LUT is baked once.** LUTs are cached on the media volume in `review_media/luts/<key>.csp`, keyed by the config
   setting and the four names, and written atomically so two workers can bake at once. Each job copies its LUT into its own
   folder. Editing a `config.ocio` in place is not noticed; the folder is deleted by hand (pre-deploy checklist).
5. **What is transformed** (Q-RP-69): the colour space the upload names. Without one, EXR frames take the project's
   `color_space`. Without either, nothing is transformed: movies, stills and display-referred frames are taken as graded for
   display, as before. `Version.color_space` is not read, because it says ACEScg on every version, H.264 movies included.
6. **Names are checked where they are written** (Q-RP-71): a project's colour space, view and look, and an upload's colour
   space, must be ones the config knows. They are stored as the config spells them. A stored value from before is left
   alone; when the config does not know it, copies are made without a transform and say so.
7. **A copy is never refused for colour.** When the config cannot be read, the name is unknown, or the bake fails, the copy is
   made by the rule before RP-15. The probe records why (`colour_skipped`), and the failure is logged.
8. **A copy records how it was made** (`probe.ocio`: config, input, display, view, look). The project's review-copies count
   compares that with what the copy would be made with now, and the movies that differ can be remade (RP-14). While the
   config cannot be read, no copy counts as differing, so a passing outage never offers to remake copies without their
   transform.

## Consequences

- Review copies of EXR frames match the studio's viewing pipeline. With the default config and the project default
  (`ACEScg`), every EXR copy made after the upgrade looks different from before. EXR sequence copies made before it are
  counted as differing and cannot be remade (their frames are not kept, Q-RP-56).
- One more native dependency in the images (about 6 MB). Its security advisories are followed by the dependency audit
  (pip-audit), as for every Python package.
- The web image can read the config, so a studio config must be mounted into the web container as well as `celery-media`.
- The LUT approximates the transform: a 129³ cube would halve the worst error on extreme HDR greens, at four times the size
  (cube size is a constant, `transcode/colour.py`).
- Only the sRGB display (Q-RP-70): no P3 or HDR copies, no 10-bit copies, no per-shot grades (CDL).

## When to revisit

- **When Debian stable's ffmpeg has the `ocio` filter** (FFmpeg 8.1 or later): apply the config directly in ffmpeg and drop
  the bake and the cache. The setting, the checks, the probe and the API stay as they are.
- When copies for P3 or HDR screens are wanted (Q-RP-70 B), or projects change views mid-show often enough that sequence
  frames should be kept for remaking (Q-RP-72 B).
