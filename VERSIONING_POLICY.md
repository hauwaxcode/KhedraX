# KhedraX Architecture Versioning Policy
### Establishes: Architecture v1.0 is LOCKED

This document governs how `KHEDRAX_CONSTITUTION.md` and
`SYSTEM_ARCHITECTURE.md` are allowed to change going forward. It exists to
do deliberately, with an explicit rule, what the two governing documents
have done informally and correctly since Work Package #1: keep the
architecture stable while KhedraX grows.

**The architecture version is distinct from KhedraX's own `package.json`
version.** The architecture version tracks the *shape* of the system — the
engine map, the dependency graph, ownership boundaries, and the DNA
schema's top-level structure. The package version tracks code releases.
They will drift independently and that's expected: many code releases can
happen within a single architecture version.

---

## 1. Current status

**Architecture v1.0 is locked as of Work Package #9's completion.** The
frozen baseline is:
- `KHEDRAX_CONSTITUTION.md` v1.0 (15 principles)
- `SYSTEM_ARCHITECTURE.md` v1.0 (13 engines, the dependency graph in §2,
  the ownership matrix in §3)
- `AgentDNA`'s top-level shape: `buildId, name, description, agent, persona,
  modules, memory, tools, workflows, deployment, testing`
- The fixed producer-invocation order: `template, module, persona, prompt,
  memory, documentation`, then Packaging Engine

Every work package from #1 through #9 operated within this baseline. None
of them required a version bump under the rules below — confirming, after
the fact, that the rules describe what already happened rather than
inventing new constraints this project hasn't actually been following.

## 2. What's allowed within v1.x (patch/minor — no sign-off required beyond normal work-package review)

- Adding new entries to any registry: `agentTypes/`, `modules/`,
  `personas/`, `memoryBackends/`, and any future registry category added
  the same way. This is the primary mechanism Constitution #3 and #13 were
  designed to make cheap, and it's the main activity the next phase of
  work (growing registries, generating real projects) will consist of.
- Deepening an existing engine's internal implementation, as Work Packages
  #2 through #8 all did, **without** changing that engine's ownership
  boundary (what it may read, write, or must never touch) or the fixed
  producer order.
- Adding a new **optional** sub-field to an existing top-level `AgentDNA`
  section (Constitution #9's additive-schema rule already requires this to
  be backward-compatible — a v1.0-generated `agent.yaml` must still be
  valid input under any v1.x schema).
- Adding a new CLI flag that doesn't change the behavior of any existing
  flag when omitted (the same pattern `--persona` followed in Work Package
  #9).
- Refactoring internal implementation (e.g. extracting shared logic, as
  Work Package #8 did with `detectExclusiveConflicts`) as long as observed
  behavior for every already-passing test and already-verified acceptance
  criterion is unchanged.
- Adding a wholly new engine that sits *alongside* Generation Engine —
  invoked as an additional step Workflow Engine sequences, not inserted
  into Generation Engine's own fixed producer list — as long as it changes
  neither Generation Engine's producer order nor any existing engine's
  ownership boundary. This is different from "adding/removing a producer
  engine" in §3: a new engine that Workflow Engine sequences as a second,
  independent step is a peer of Generation Engine, not a change to what
  Generation Engine itself orchestrates.

A v1.x bump (v1.0 → v1.1, v1.1 → v1.2, ...) happens whenever a change in
this category lands. It's a version-number increment and a one-line
`CHANGELOG.md` entry — not a new architecture review.

## 3. What requires v2.0 (breaking — requires explicit human sign-off and its own dedicated work package)

- Changing the fixed producer-invocation order, or adding/removing a
  producer engine from it.
- Changing any engine's ownership boundary — what it may read, write, or
  must never touch, as defined in `SYSTEM_ARCHITECTURE.md` §3.
- Removing or renaming an existing top-level `AgentDNA` field, or changing
  an existing field's meaning (as opposed to adding a new optional
  sub-field to it).
- Changing the required folder structure contract for `modules/`,
  `personas/`, `agentTypes/`, or `memoryBackends/` entries (e.g. requiring
  a new mandatory file every existing entry would need to be updated to
  have).
- Any change that would make a project generated under the current version
  fail to validate, or mean something different, under the new one.

A v2.0 (or v3.0, etc.) bump requires: an explicit proposal describing what
breaks and why it's worth breaking, a migration note for anything already
generated under the prior major version, and a dedicated work package for
the change itself — it does not happen as a side effect of an unrelated
package, the same way Work Package #7's `khedraxRootDir` plumbing was
called out explicitly as a scoped exception rather than folded silently
into an unrelated change.

## 4. Process going forward

- Every future work package document states which architecture version it
  targets (e.g. "Targets: v1.x, no architecture version bump required" or
  "Targets: v2.0 — see migration notes").
- `CHANGELOG.md` (new file, created alongside this policy) records every
  version bump: date, version, one-line description, and the work package
  that caused it.
- `KHEDRAX_CONSTITUTION.md` and `SYSTEM_ARCHITECTURE.md`'s version headers
  are bumped together — they share one version number, since they describe
  one architecture.
- If a work package's own reviewer (the same review discipline applied
  since Work Package #1 — reading the actual diff, running tests
  independently, reproducing acceptance criteria by hand) finds that a
  change landed in the v2.0 category without going through that process,
  that's treated as a defect in the work package, the same as any other
  bug found during review — not retroactively approved because it already
  shipped.
