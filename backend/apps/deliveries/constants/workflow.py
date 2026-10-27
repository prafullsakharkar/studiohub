"""
Delivery status groups (docs/deliveries/CONTRACTS.md DOM-DLV-02).

Phase 6 needs only the line between a delivery that can still change and one that has been sent;
the full transition map (Signed Off, who may do what) is Phase 7 and will live in this file.
"""

from __future__ import annotations

DRAFT = "Draft"
VALIDATING = "Validating"
PREPARED = "Prepared"
SUBMITTED = "Submitted"

#: Items and details can change only here. Once a delivery is sent (Submitted or later) nothing
#: about what it contains can change.
WORKING_STATES = frozenset({DRAFT, VALIDATING, PREPARED})
