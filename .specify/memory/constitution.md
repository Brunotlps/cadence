<!--
Sync Impact Report
- Version change: unratified template -> 1.0.0
- Modified principles: none; initial ratification establishes Principles I-V.
- Added sections: Scope of Authority; Compliance and Responsibility Boundaries; Governance.
- Removed sections: unresolved template placeholders and examples.
- Follow-up TODOs: none.
-->

# Cadence Constitution

## Core Principles

### I. Database-Enforced Tenant Isolation

All workspace-scoped user data MUST have authorization enforcement at the database
layer. Application-side filtering MUST NOT be considered a sufficient tenant-isolation
boundary by itself. Changes introducing or modifying workspace-scoped data MUST preserve
database-level isolation controls and MUST NOT weaken existing effective authorization
guarantees.

Rationale: Tenant isolation is a trust boundary; an application bug must not turn a
missing filter into cross-workspace access.

### II. Authenticated and Least-Privilege Data Access

Ordinary user-data access MUST preserve the authenticated user's authorization context
and effective database access controls. Authorization bypasses or privileged access
paths MUST be explicit, server-side, narrowly scoped, justified by a concrete
administrative requirement, and independently auditable. Privileged credentials MUST
NOT be exposed to client-side code.

Rationale: The invariant is preservation of authorization context and least privilege,
independent of implementation technology.

### III. Privacy by Default and Data Minimization

Cadence MUST minimize collection, processing, retention, and observability of personal,
sensitive, behavioral, network-identifying, and financial data. Such data MUST NOT be
newly collected, retained, exposed, or logged without a documented legitimate product
purpose, an explicit update to the applicable durable privacy/security contract, and
appropriate user controls or safeguards where that contract requires them. Logs and
diagnostics MUST avoid personal and financial values unless an explicitly reviewed
requirement establishes a safe exception.

Rationale: Privacy constraints must survive product evolution while permitting a
deliberate, reviewed introduction of additional collection when justified.

### IV. Real and Explicit Data Lifecycle Guarantees

Changes MUST preserve Cadence's documented guarantees for deletion, retention, and data
portability. Deletion semantics MUST represent genuine removal or documented lifecycle
behavior. Personal data MUST NOT be hidden behind indefinite soft-retention semantics
unless an explicit durable contract and reviewed exception permits it.

Rationale: The Constitution protects lifecycle guarantees; durable system contracts
define their exact implementation semantics.

### V. Regression Proof for Critical Invariants

Changes affecting authentication or session boundaries, tenant isolation or
authorization, privileged access, deletion or retention, data portability, or
financial-domain integrity MUST include focused regression evidence. That evidence
SHOULD be placed at the lowest reliable layer capable of proving the invariant. When the
database is the final enforcement layer, application-only tests MUST NOT be treated as
sufficient proof of database authorization or integrity. Existing hosted and compliance
test safety constraints remain governed by the repository harness.

Rationale: Critical guarantees require evidence that their effective enforcement still
holds, not merely implementation that appears correct.

## Scope of Authority

This Constitution governs stable, cross-feature engineering invariants. The detailed,
durable privacy and security contracts reside in `.cadence/policies/`; detailed domain
and system contracts reside in `docs/specs/`. Feature specifications may introduce or
change product behavior, but MUST NOT silently violate these principles.

`AGENTS.md`, `CLAUDE.md`, and `.codex/` govern agent and developer operational behavior
and are not replaced by this Constitution. `docs/planning/` is historical context.

## Compliance and Responsibility Boundaries

Constitution principles define global constraints; durable contracts define detailed
system guarantees; feature specifications define bounded intended behavior; and
runtime, tests, and database controls provide evidence of implemented behavior. These
layers MUST NOT be used to create a second source of truth for detailed domain behavior.

## Governance

Constitutional amendments require explicit rationale and semantic versioning. A MAJOR
revision removes or incompatibly redefines an existing principle; a MINOR revision adds
a principle or materially expands governance; a PATCH revision is a non-semantic
clarification.

Spec Kit plans MUST evaluate every proposed change against all five principles. A known
violation MUST be resolved explicitly rather than silently ignored. Necessary exceptions
MUST be documented in the appropriate durable policy or system-contract layer and MUST
NOT be invented ad hoc in a feature implementation.

**Version**: 1.0.0 | **Ratified**: 2026-08-24 | **Last Amended**: 2026-08-24
