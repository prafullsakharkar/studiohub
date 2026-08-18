# Publish Validators — Framework & Examples

Generated: 2026-08-18T12:34:07+05:30

Purpose
-------
Document the validator framework used during publish pipelines and examples of common validators.

Validator contract
------------------
A Validator implements:
- validate(context, candidate) → ValidationResult

ValidationResult:
- status: PASSED | WARNING | FAILED
- code: short identifier
- message: human-readable explanation
- details: optional structured data
- fix: optional auto-fix descriptor (if safe)

Validator lifecycle
--------------------
- Pre-publish: naming, metadata, presence of files
- During-publish: checksums, frame ranges, file integrity
- Post-publish: manifest verification, downstream checks

Common validators
-----------------
- naming_validator
- checksum_validator
- frame_range_validator
- scene_dependency_validator
- license_and_embargo_validator

Auto-fix
--------
Auto-fix should be opt-in and only used for safe, reversible operations. Auto-fix must always be logged and subject to explicit user approval when destructive.

End of validators document.
