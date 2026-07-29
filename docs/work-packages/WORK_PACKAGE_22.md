# KhedraX Work Package #22
### Skill Packs — real-world knowledge modules, generation-time and
### post-generation

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.9, `SYSTEM_ARCHITECTURE.md`
v1.9, `VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`,
`WORK_PACKAGE_15.md` (the CLI-launcher precedent this reuses),
`WORK_PACKAGE_17.md`/`WORK_PACKAGE_18.md` (the "represent a new domain as
modules, not a new engine" precedent this repeats). **Targets: Architecture
v1.9 — no bump required for Part A; Part B is a new CLI command reusing
existing engine logic, not a new engine, so it stays v1.x too.**

This prompt is implementation-ready. Do not make architectural decisions.

---

## 1. Engineering Objective

Two related but separable capabilities:

**Part A — Skill packs as modules (generation-time).** A "skill pack" is
just a module whose `implementation/` directory carries real domain
knowledge (FAQ content, procedures, example interactions) instead of only
scaffold-only placeholders. Nothing new architecturally — this proves the
module system already supports this by adding a handful of real examples.

**Part B — Post-generation module addition (the genuinely new part).** A
new CLI command, `khedrax add-module <projectPath> <moduleName>`, that
adds a module to an **already-generated** project — reusing Module
Engine's, Prompt Engine's, and Documentation Engine's existing rendering
logic, invoked against that project's directory instead of a fresh temp
directory. This is what makes it possible to hand someone a scaffolded
agent today and enrich it with real knowledge next week, without
regenerating from scratch.

## 2. Why This Exists

Every generated agent today is a well-structured scaffold — correct,
composable, standalone — but "scaffold" is the right word: a
`customer-support` agent doesn't ship with any actual company's real FAQ,
procedures, or product knowledge, because KhedraX can't know that at
generation time for an arbitrary company. Part A proves a skill pack is
just data, exactly like a billing model or auth provider. Part B answers
the more interesting question this raises: what happens when you *do* get
real content later — after the agent already exists? Right now, the only
answer is "regenerate from scratch and manually re-apply any hand-edits,"
which defeats the purpose of having generated something in the first
place. This closes that gap.

## 3. Architecture Boundaries

- Part A requires zero engine changes — Module Engine already copies
  whatever's inside `implementation/`, `configuration/`, `prompts/`,
  `tests/` wholesale. Real knowledge content is just richer content in
  files that already get copied.
- Part B's CLI command does not become a ninth engine. It's a CLI-level
  orchestrator that calls **existing** engine logic — Module Engine's
  module-resolution-and-copy function, Prompt Engine's `composePrompt()`,
  Documentation Engine's rendering functions — against a *target
  directory* parameter instead of always assuming a fresh `tempDir`. If
  any of those three engines' functions currently hardcode "operate on a
  freshly created temp directory," that assumption needs to become a
  parameter, not a new copy of the function. Do not duplicate rendering
  logic to avoid touching an existing function's signature — extending a
  parameter is Level 4 (deepening in place), duplicating the logic is the
  kind of drift Work Package #13's `deploy.sh` bug already taught this
  project to avoid.
- Before copying anything, `add-module` must: read the target project's
  existing `agent.yaml` to reconstruct its DNA; reject if the requested
  module is already present (reuse `findDuplicateModuleNames`-style
  logic); reject if adding it would create an exclusive-prompt-section
  conflict with an already-installed module (reuse
  `detectExclusiveConflicts`, the same shared function Validation Engine
  and Prompt Engine already both use — do not write a third
  implementation of this check).
- After a successful add, `agent.yaml`'s `modules:` list, `prompts/README.md`,
  and `docs/README.md` must all be updated to reflect the addition — a
  partial update (e.g. files copied but `agent.yaml` not updated) leaves
  the project internally inconsistent and is worse than refusing outright.
- This command operates on an **already-generated, standalone project**.
  It is a development-time convenience the same way `--plugin-path`
  extends KhedraX's own registries — it does not make the generated
  project depend on KhedraX at runtime. The project remains fully
  standalone before and after running this command; the command is a tool
  applied *to* it, not a dependency *of* it.
- No network access, no execution of anything beyond file reads/writes and
  the existing render functions. Same safety discipline as every other
  package.

## 4. Files to Create / Modify

```
khedrax/modules/faq-support/          (NEW, Part A example skill pack)
khedrax/modules/onboarding-flow/      (NEW, Part A example skill pack)
khedrax/modules/incident-runbook/     (NEW, Part A example skill pack)

khedrax/src/engines/moduleEngine.ts       (MODIFY only if resolution logic
                                            needs a targetDir parameter —
                                            check before assuming a change
                                            is needed)
khedrax/src/engines/promptEngine.ts       (MODIFY: composePrompt already
                                            takes a fragments list — confirm
                                            it can be re-invoked against an
                                            existing prompts/ tree; add a
                                            parameter if not, don't duplicate)
khedrax/src/engines/documentationEngine.ts (MODIFY: same check as above for
                                             its render functions)

khedrax/src/cli/addModule.ts          (NEW: the add-module orchestration —
                                        reads agent.yaml, validates, calls
                                        the three existing engines' logic
                                        against the target directory,
                                        writes the updated agent.yaml)
khedrax/src/cli/bin/khedrax.ts        (MODIFY: register `add-module`
                                        subcommand)

khedrax/tests/unit/addModule.test.ts       (NEW)
khedrax/tests/unit/skillPackModules.test.ts (NEW, Part A)
```

## 5. Part A: Three Example Skill-Pack Modules

**`modules/faq-support/module.json`:**
```json
{
  "name": "faq-support",
  "version": "1.0.0",
  "capabilities": [
    "Answer common support questions from a curated FAQ."
  ],
  "constraints": [
    "Never answer from the FAQ content if the question falls outside what it actually covers — escalate instead of guessing."
  ]
}
```
`implementation/faq.md`: a real, filled-in example FAQ (5-10 realistic
Q&A pairs for a generic SaaS product — actual content, not "TODO", since
the whole point of a skill pack is to demonstrate real knowledge, unlike
every other module's deliberately scaffold-only `implementation/README.md`).
Same `configuration/`, `prompts/`, `tests/` shape as every other module.

Follow the same pattern for `onboarding-flow` (a real step-by-step
onboarding script) and `incident-runbook` (a real incident-response
checklist) — three different shapes of "real knowledge content" to prove
the module system generalizes to genuinely populated content, not just
scaffold placeholders.

## 6. Part B: `add-module` Command

```typescript
// src/cli/addModule.ts
export async function addModule(projectPath: string, moduleName: string, rootDir: string): Promise<void> {
  // 1. Read and parse the existing agent.yaml at projectPath.
  // 2. Reconstruct enough of the DNA to validate against (name, modules list).
  // 3. Load the registry from rootDir; confirm moduleName exists.
  // 4. Reject if moduleName is already in the project's modules list.
  // 5. Reject if adding it creates an exclusive-prompt-section conflict
  //    with any already-installed module (reuse detectExclusiveConflicts —
  //    read each already-installed module's fragment.meta.json from the
  //    project's own namespaced prompts/<name>/ directory, plus the new
  //    module's from the registry).
  // 6. Copy the new module's implementation/configuration/prompts/tests
  //    into projectPath, namespaced by module name — reuse Module Engine's
  //    existing copy function against projectPath instead of a temp dir.
  // 7. Re-render prompts/README.md and docs/README.md to include the new
  //    module — reuse Prompt/Documentation Engine's existing render
  //    functions against projectPath.
  // 8. Rewrite agent.yaml's modules: list to include the new module,
  //    preserving every other field exactly as it was.
}
```

CLI registration: `khedrax add-module <projectPath> <moduleName>`.

## 7. Required Tests

1. `skillPackModules.test.ts` (Part A): each of the three skill-pack
   modules generates correctly via the normal `--modules` flag at creation
   time, with their real content appearing in the output — same pattern
   as every prior module test.
2. `addModule.test.ts` (Part B), at minimum:
   - Adding a module to a freshly generated project succeeds: `agent.yaml`,
     `prompts/README.md`, and `docs/README.md` all correctly reflect the
     addition.
   - Adding an already-present module is rejected with a clear error.
   - Adding a module that would create an exclusive-prompt-section
     conflict with an already-installed one is rejected — reuse the same
     conflict fixture pattern from Work Package #8.
   - The target project's other files (deployment/, interface/, memory/,
     any previously-added module's files) are untouched by the operation —
     confirm this explicitly via checksum/diff, not just that the new
     module's files appear.
   - Running `add-module` twice in a row for two different, compatible
     modules both succeed and both appear correctly afterward (proving
     this composes, not just works once).

## 8. Deliverables

1. Three skill-pack modules (§5).
2. `addModule.ts` + CLI registration (§6).
3. Both test files (§7).
4. `docs/SKILL_PACKS.md` — explains the concept, lists the three example
   modules, and documents the `add-module` command's usage and guarantees
   (what it checks before adding, what it updates, what it never touches).
5. `CHANGELOG.md` entry (v1.9 → v1.10), byte-level formatting verified
   with the actual check (`head -c 1 CHANGELOG.md | od -An -tx1` plus the
   leading-whitespace awk scan) before reporting done.
6. Version headers bumped to v1.10 together in both governing documents.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --modules faq-support --force` produces
   real FAQ content in the output — paste it.
2. Generate a project with no `faq-support`, then run
   `khedrax add-module <path> faq-support` against it — paste the
   before/after `agent.yaml` modules list and confirm `prompts/README.md`/
   `docs/README.md` now include it.
3. Attempt to add an already-present module and confirm the clear
   rejection — paste it.
4. Construct the exclusive-conflict scenario from §7 and confirm rejection
   — paste it, and confirm (as in every prior conflict test) that nothing
   was partially written.
5. `npm test` and `npm run typecheck` both pass — paste raw output.
6. Zero changes to any producer engine's ownership boundary or the fixed
   producer order — confirm the three modified engine files only gained a
   parameter/reused logic, not new behavior, by diffing against the
   pre-package state and explaining every change.
7. `CHANGELOG.md`'s byte-level check passes, pasted directly — not a
   `git diff` proxy.
8. Commit locally; state clearly whether you also pushed.

