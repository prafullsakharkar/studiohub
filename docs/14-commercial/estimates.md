Estimates & Bids — Guidance

Purpose

Define internal estimates, bid generation, versioning, approval and conversion to client-facing proposals.

Key distinctions

- Estimate: internal cost projection (labor, vendor, render, storage) used for internal decision making.
- Bid/Proposal: client-facing commercial proposal derived from estimates and adjusted for billing rates, margins, and commercial terms.

Estimate lines

- Category (labor|vendor|render|storage|expense)
- Description
- Quantity (hours, units, shots)
- Unit rate
- Amount
- Cost vs Billing rates (store both if different)

Versioning & approvals

- Estimates are versioned. Once an estimate is approved internally, record approval metadata and do not overwrite historical versions.
- When an estimate is promoted to a client proposal (bid), generate a Proposal record that references the estimate version used.

Next steps

- Add approval workflow and permissions for estimate approvals.
- Add mapping to project budget creation upon approval (optional).