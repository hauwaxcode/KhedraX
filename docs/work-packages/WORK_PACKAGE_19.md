# KhedraX Work Package #19
### Admin Dashboard — roadmap closure and billing/auth-aware enrichment

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.8, `SYSTEM_ARCHITECTURE.md`
v1.8, `VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`,
`WORK_PACKAGE_16.md` (Interface Engine, which already implements this
deliverable's architecture). **Targets: Architecture v1.9 — no bump
required** (Level 4: deepening Interface Engine's existing `admin`
template rendering, no new engine, no DNA change, no ownership boundary
change).

This prompt is implementation-ready. Do not make architectural decisions.

---

## 1. What This Package Actually Is

Per `ENGINE_DECISION_HIERARCHY.md`'s standing disposition, Admin Dashboard
is a **roadmap entry, not a separate architectural component** — it was
already implemented, architecturally, in Work Package #16 as the
`interfaces/admin/` entry inside Interface Engine. This package does two
things:

1. **Closes the roadmap entry formally** with a short reference document
   stating the disposition for the historical record — the same kind of
   documentation `docs/BILLING_MODELS.md` and `docs/AUTH_PROVIDERS.md`
   already provide for their own work packages.
2. **Enriches the existing `admin` template** with a small, genuinely
   useful addition: now that Work Package #17 (billing modules) and #18
   (auth modules) exist, the admin dashboard can show which billing model
   and which auth providers a generated agent actually uses — data that
   didn't exist yet when Work Package #16 built the template, and which
   Work Package #16 explicitly deferred rather than fabricate.

Do not build a fifth engine, a new DNA field, or a new registry category.
This is Interface Engine, deepened, exactly as `VERSIONING_POLICY.md` §2
already permits for any existing engine.

## 2. Architecture Boundaries

- The enrichment reads data Interface Engine already receives —
  `dna.modules` (or the resolved module descriptors already passed into
  its rendering context) — filtered by name prefix (`billing-`/`auth-`).
  No new registry lookup, no new DNA field, no change to what data flows
  into Interface Engine.
- If no billing module is present, omit the "Billing" section entirely —
  do not render an empty or "none" placeholder section. Same for
  Authentication. This matches the established "omit if absent" pattern
  (Documentation Engine's Escalation section, Prompt Engine's Instructions
  layer) rather than the "show none" pattern used for persona/modules in
  the admin template's existing fields — the two conventions coexist
  intentionally: fields that are always conceptually present (persona,
  modules) show "none" when empty; whole sections that are conditionally
  relevant (billing, auth) are omitted when not applicable.
- If **multiple** billing or auth modules are present (e.g. someone
  selects two auth providers), list all of them — do not assume exactly
  zero or one.
- No change to `interfaceEngine.ts`'s safety boundary from Work Package
  #16 — it still never executes/fetches/spawns anything; this is more
  rendering logic, not new capability of a different kind.

## 3. Implementation

In `interfaceEngine.ts`'s admin-rendering path, after the existing
name/type/persona/modules rendering: filter the resolved module list for
names starting with `billing-` and names starting with `auth-`. If the
billing list is non-empty, render a `<h2>Billing</h2>` section listing
each billing module's name (and optionally its one-line capability
summary, matching how the rest of the dashboard already renders module
data). Do the same for `<h2>Authentication</h2>` with `auth-` modules.

## 4. Required Tests

1. Admin dashboard generated with a billing module present shows the
   Billing section with the correct module name(s).
2. Admin dashboard generated with an auth module present shows the
   Authentication section correctly.
3. Admin dashboard generated with **both** a billing and an auth module
   shows both sections.
4. Admin dashboard generated with **neither** (the Work Package #16
   baseline case) shows neither section — confirm this explicitly, since
   it's the regression proof that existing behavior for agents
   without billing/auth is unchanged.
5. Admin dashboard generated with **two** auth modules shows both listed,
   not just one (proving the list isn't assumed to be singular).

## 5. Deliverables

1. `interfaceEngine.ts` enrichment (§3).
2. `docs/WP19_ADMIN_DASHBOARD.md` (new) — short document stating: the
   roadmap deliverable (an admin dashboard showing an agent's
   configuration at a glance), the architectural disposition (implemented
   via Interface Engine's `admin` template, Work Package #16; enriched in
   this package to surface billing/auth data), and an explicit note that
   no separate engine exists or is planned for this.
3. `CHANGELOG.md` entry (v1.8 → v1.9), byte-level formatting verified with
   the actual check (`head -c 1 CHANGELOG.md | od -An -tx1` and the
   leading-whitespace awk scan) — not a `git diff --exit-code` proxy,
   which doesn't test the same thing and was mistakenly used as a
   substitute in Work Package #18's verification.
4. Version headers in `KHEDRAX_CONSTITUTION.md` and `SYSTEM_ARCHITECTURE.md`
   bumped to v1.9 together.

## 6. Acceptance Criteria

1. `khedrax create X --type basic --modules billing-subscription,memory --interface admin --force` produces an admin dashboard with a Billing section — paste the real generated `interface/index.html`.
2. `khedrax create Y --type basic --modules auth-google,auth-siwe --interface admin --force` produces a dashboard with an Authentication section listing both providers — paste it.
3. `khedrax create Z --type basic --interface admin --force` (no billing/auth modules) produces a dashboard with neither section — paste it, confirming the regression proof.
4. `npm test` and `npm run typecheck` both pass — paste raw output.
5. Zero changes outside `interfaceEngine.ts`, the new doc, and the version/changelog files — confirm by diffing everything else against the pre-package state.
6. The actual byte-level `CHANGELOG.md` check (not the `git diff` proxy) is run and its raw output pasted.
7. Commit locally; state clearly whether you also pushed.

