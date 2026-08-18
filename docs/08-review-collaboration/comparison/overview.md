# Comparison — A/B, Side-by-Side, Wipe & Onion-Skin

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Describes supported comparison modes in the review player: side-by-side, wipe, A/B toggle, difference, onion-skin and synchronization rules for frame-accurate comparisons.

Comparison modes
----------------
- Side-by-side: two synchronized players
- Wipe: interactive wipe control between A and B
- A/B toggle: instantaneous swap between A and B
- Difference: pixel-wise difference visualization (optional)
- Onion-skin: blended overlays for animation reference

Sync & frame accuracy
---------------------
- Ensure both representations use identical frame ranges and frame rates; resample or normalize when necessary
- Preserve timecode/frame accuracy when comparing versions

Performance
-----------
- Use proxy representations for comparison where possible
- Defer expensive difference calculations to server-side or optional on-demand tasks

APIs & events
-------------
- ComparisonRequested, ComparisonCompleted

End of comparison doc.
