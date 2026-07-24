# KhedraX Engine Decision Hierarchy
### Mandatory review before any new engine is proposed

Companion to `KHEDRAX_CONSTITUTION.md`, `SYSTEM_ARCHITECTURE.md`, and
`VERSIONING_POLICY.md`. This document formalizes a discipline this project
has already applied informally, case by case, since Work Package #4 (which
proved eight portfolio agents needed zero engine changes) through Work
Package #13/#14 (which resolved "add deployment" without adding a producer
engine). Writing it down now makes that discipline a checkable rule rather
than a judgment call repeated fresh each time.

---

## The Rule

Before implementing any work package, determine whether the requested
capability can be achieved through, in this order:

1. **Registry growth** — can this be solved by adding data?
2. **Templates** — can an existing engine generate different output from
   richer templates?
3. **Configuration** — can additional config drive the behavior?
4. **Existing engine enhancement** — can one existing engine produce this
   without changing its ownership boundary, the producer order, or the
   DNA top-level schema?
5. **New engine** — only when 1–4 are genuinely impossible.

Stop at the first level that works. Do not reach for a higher (more
architecturally invasive) level than the capability actually requires.

## Level 1 — Registry Growth (preferred, and almost always sufficient)

Examples already proven in this project: agent types (Work Package #10),
personas (Work Package #2, #10), modules (Work Package #4, #10, #12),
memory backends (Work Package #6), deployment targets (Work Package #13,
#14), plugin roots as a discovery mechanism (Work Package #11).

If a request can be satisfied by adding a new `.json`/`.md` file under an
existing registry directory — stop here. This is the overwhelming majority
of what "KhedraX grows" should mean.

## Level 2 — Templates

Can an existing engine render richer output from its existing inputs
without new registry categories or new engine logic? Example: Work Package
#14 added `config.yaml` rendering to Deployment Engine using data already
on the existing `deployment.json` descriptor — no new engine, no new
registry, just a richer template path through an engine that already
existed.

## Level 3 — Configuration

Can additional fields on an *existing* registry entry's descriptor (still
additive, per `VERSIONING_POLICY.md` §2) drive different behavior, without
new files or new engines? Example: Work Package #14's `secretsDescriptions`,
`environmentTemplate`, and `verificationStrategy` fields — new optional
data on the same `deployment.json` shape, consumed by the same
already-existing Deployment Engine.

## Level 4 — Existing Engine Enhancement

Can one of the 14 existing engines (13 from Work Package #1's original
map, plus Deployment Engine from Work Package #13) produce the needed
output without changing:
- its ownership boundary (what it reads/writes/never touches, per
  `SYSTEM_ARCHITECTURE.md` §3),
- the fixed producer order, or
- the DNA schema's top-level shape (only additive optional sub-fields)?

If yes, deepen that engine only — this is what Work Packages #2, #3, #5,
#6, #7, #8 all did to their respective engines.

## Level 5 — New Engine (last resort)

Only when Levels 1–4 are genuinely impossible. Before any implementation
proceeds, produce and get explicit sign-off on:

1. **Why existing engines cannot support it** — name which ones were
   considered and why each falls short.
2. **Which constitutional boundary is being reached** — cite the specific
   principle from `KHEDRAX_CONSTITUTION.md`.
3. **Expected blast radius** — which files, which existing tests, which
   already-verified acceptance criteria could be affected.
4. **Migration impact** — does anything already generated under the
   current version stop being valid?
5. **Why this is not registry growth, a template, or configuration** —
   explicit rejection of Levels 1–3, not just an assumption they don't
   apply.
6. **Whether this targets Architecture v1.x or requires v2.0**, per
   `VERSIONING_POLICY.md` §2/§3.

If the answer to §6 is v1.x, the **only** currently-approved mechanism for
a new engine to stay v1.x is the conditional-call pattern `VERSIONING_POLICY.md`
§2 describes — a call inside `GenerationEngine.run()` itself, after the
producer loop, never added to the `producers` array. This is proven twice:
Work Package #13's Deployment Engine, and (pending) an Interface Engine
following the identical pattern. A new engine that doesn't fit this
pattern and still claims v1.x is a defect in the work package, not an
acceptable variant.

No implementation proceeds past this review without explicit approval.

---

## Standing dispositions for named future capabilities

Recorded here so future work packages don't re-litigate the same analysis:

- **Deployment CLI** (`khedrax deploy`/`status`/`logs`/`rollback`/
  `destroy`/`update`) — Level 4. Already resolved by Work Package #13's
  thin-launcher design: these are CLI commands that locate a generated
  project and exec its own scaffolded script. No new engine, no producer
  change.
- **Interface Engine (WP16)** (web/Telegram/Discord/admin dashboards) —
  Level 5, approved to proceed under the Work Package #13 conditional-call
  pattern. The interface *type* is registry data; the scaffolding logic
  for each interface category is genuinely new producer-adjacent behavior,
  which is why this is Level 5 and not Level 1 — but it fits the same
  non-producer conditional-engine slot Deployment Engine already proved
  out. Constitutional boundary to hold: the interface engine emits static
  scaffold code, never a hosted/running service — same "generates
  software, doesn't execute or host it" line as every other engine.
- **Admin Dashboard (WP19 on the roadmap)** — remains its own roadmap
  entry, since roadmap numbering tracks user-facing functionality, not
  implementation mechanism. **Architectural disposition: implemented as
  the admin interface template within the Interface Engine (WP16). No
  separate engine is introduced.** A dashboard is a view of data other
  engines already produce (billing, usage, deployments, logs); building it
  as a distinct engine would duplicate WP16's own scaffolding logic. WP19
  as a work package document should describe the admin-dashboard
  *deliverable* (what a user gets) while explicitly pointing at WP16 for
  *how* it's built — this keeps the roadmap's promise to users intact
  without letting architecture drift into a fifth engine that does what a
  template inside the fourth one already does.
- **Billing & Monetization** — decomposes entirely into existing levels:
  billing model list is Level 1 (registry), pricing/wallet-routing config
  is Level 3, billing middleware code is Level 4 (treat as a Module Engine
  category, same as `discord`/`email`/`github`), invoice/receipt templates
  are Level 2, billing documentation is already Documentation Engine's job.
  **No new engine.** If an implementation proposes a standalone
  `billingEngine.ts`, that's scope creep to redirect, not approve.
- **Authentication** — same shape as Billing: providers are Level 1
  registry entries, generated auth code is a Level 4 Module Engine
  category. No new engine.
- **Marketplace** (publishing/installing components) — **decided: a
  deliberate, separately-governed companion service/CLI, not a KhedraX
  engine.** Publishing and installing implies a live service: accounts,
  versioning, a network fetch at install time. That collides directly
  with Constitution #14/#15 — this is an external distribution system
  that reads from KhedraX's registries but runs *outside* the generator,
  not a capability any engine can scaffold its way into. It is not Level
  5 either; it's a different kind of thing entirely. If and when this gets
  built, it is its own project with its own governance (mirroring how
  Hydra_Genesix's own tooling is separate from Hydra_Genesix itself) —
  not a KhedraX work package, not part of KhedraX's own architecture
  version, and not something any future work package should fold in as a
  side effect.
- **Production Validation** — Level 4 (extends Validation Engine with
  post-generation smoke tests) or no engine at all (pure process/CI
  methodology sitting outside the generator). Either way, zero new
  engines. Also worth remembering from the original roadmap discussion:
  this is a human-operated validation exercise requiring real credentials
  and a live network — not something KhedraX's own automated test suite
  can or should perform.

