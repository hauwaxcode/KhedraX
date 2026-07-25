# KhedraX System Architecture Overview
### v1.6 — companion to KHEDRAX_CONSTITUTION.md v1.6

The Constitution defines **how** KhedraX must be built. This document defines
**what** exists in the system: the complete set of engines, how they depend
on one another, and — for each one — exactly what it owns, reads, writes,
and must never touch.

Every engine listed here exists **architecturally** from v1, even if its v1
implementation is a thin pass-through. New capability is added by deepening
an existing engine's implementation, never by inventing a new one outside
this map or by letting one engine quietly absorb another's responsibility.

---

## 1. The Complete Engine Map

```
KhedraX
├── CLI
├── Workflow Engine
├── Validation Engine
├── Generation Engine
├── DNA System
├── Registry System
├── Template Engine
├── Module Engine
├── Persona Engine
├── Prompt Engine
├── Memory Engine
├── Documentation Engine
├── Packaging Engine
├── Deployment Engine   (as of Work Package #13 — NOT a producer; see §2)
└── Interface Engine    (as of Work Package #16 — NOT a producer; see §2)
```

**Deployment Engine and Interface Engine are deliberately not listed among
the six producer engines above them.** Both are separate, optional,
conditionally-invoked stages — architecturally siblings of Packaging
Engine, not members of the fixed
`template → module → persona → prompt → memory → documentation` sequence.
This distinction is load-bearing: per `VERSIONING_POLICY.md` §3, changing
the fixed producer order or adding/removing a producer from it requires a
v2.0 bump. Neither engine's addition does either of those things — the six
producers still run, unconditionally, in the exact same order as always —
so both additions are v1.x, the same classification every prior
registry-consuming engine has had since Work Package #2. Interface Engine
follows the exact conditional-call pattern Deployment Engine established:
a call inside `GenerationEngine.run()` itself, after the producer loop,
never added to the `producers` array (see `ENGINE_DECISION_HIERARCHY.md`
for the standing precedent this is built on).

### v1 implementation status

| Engine | v1 status |
|---|---|
| CLI | Fully implemented |
| Workflow Engine | Fully implemented (checkpoint + resume) |
| DNA System | Fully implemented |
| Registry System | Fully implemented (agentTypes/, modules/ — including each module's declared prompt-fragment section/exclusivity metadata — personas/, memoryBackends/, deployments/ (Work Package #13), and, as of Work Package #16, interfaces/ discovery), plus multi-root discovery across the built-in registries and any number of external plugin directories, with built-ins always taking precedence on a name collision |
| Validation Engine | Implemented at schema + registry-cross-check level, plus, as of Work Package #8, cross-field checks: duplicate module detection and a pre-flight exclusive-prompt-section conflict check shared with Prompt Engine's own generation-time check |
| Generation Engine | Fully implemented as orchestrator |
| Template Engine | Fully implemented |
| Module Engine | Fully implemented |
| Packaging Engine | Fully implemented as of Work Package #7 — writes a deterministic dependency manifest, hardens the standalone scan to also catch leaked build-time absolute paths, and skips irrelevant directories during the scan |
| Persona Engine | Fully implemented as of Work Package #2 — real persona resolution, constraint derivation, capability mapping, behavioral profile generation |
| Prompt Engine | Fully implemented as of Work Package #3 — layered composition (identity, constraints, capabilities, instructions, escalation) with named-section merging and exclusive-ownership conflict resolution, consuming Persona Engine's behavioral profile |
| Memory Engine | Fully implemented as of Work Package #6 — resolves a memory backend from a filesystem-discovered `memoryBackends/` registry (default `in-memory`), merges DNA-level config overrides onto the backend's declared defaults, and cross-references resolved modules' `requiresMemory` declarations, all within scaffold/config only (never runtime storage logic) |
| Documentation Engine | Fully implemented as of Work Package #5 — renders a concise root README.md and a detailed docs/README.md from Persona Engine's behavioral profile and Module Engine's resolved module descriptors |
| Deployment Engine | Fully implemented as of Work Package #13 — optional, conditionally-invoked (only when `dna.deployment.target` is set); resolves a deployment target descriptor from the `deployments/` registry and scaffolds a self-contained `deployment/` directory in the generated project (environment templates, a deploy script the generated project owns and runs independently, secrets placeholders, monitoring/rollback documentation); never executes any deployment action itself, per Constitution #14/#15. Deepened in Work Package #14 with richer, still-additive descriptor fields (wallet types, RPC endpoint examples, secret descriptions, non-secret environment defaults, a rendered `config.yaml`, and a human-readable verification-strategy section) — still never executes or checks anything live. Deepened again in Work Package #15 to scaffold five additional per-action scripts (`status.sh`, `logs.sh`, `rollback.sh`, `destroy.sh`, `update.sh`) alongside `deploy.sh`, using the identical render logic — Deployment Engine itself still never executes anything; only the new, separate CLI launcher (outside this engine) is permitted to spawn a process, and only the generated project's own already-existing script |
| Interface Engine | Fully implemented as of Work Package #16 — optional, conditionally-invoked (only when `dna.interface.type` is set); resolves an interface descriptor from the `interfaces/` registry and scaffolds a self-contained `interface/` directory (a working application skeleton — static chat UI, bot client, or admin dashboard shell — for the user to configure with their own credentials and run independently). Unlike Deployment Engine's deliberately inert scaffold scripts, Interface Engine's *templates* are allowed to contain real, functional application code (e.g. a Discord bot skeleton legitimately imports `discord.js` and calls `client.login(...)` within its own file) — that code is the generated project's own future runtime behavior, never executed by KhedraX itself. The boundary that must hold is narrower here than for Deployment Engine: `interfaceEngine.ts` (KhedraX's own code) must never execute/fetch/spawn anything; the *templates it copies* are exempt from that same restriction, since they are real application starting points, not inert placeholders |

Every engine marked "pass-through" or "minimum-viable" still sits in its
correct place in the dependency graph and honors its ownership boundary below.
Deepening it later is an internal change to that engine only — nothing
upstream or downstream needs to change.

---

## 2. Dependency Graph

```
CLI
 │  (parses args → builds draft AgentDNA)
 ▼
Workflow Engine
 │  (sequences steps, checkpoints each one)
 ▼
Validation Engine
 │  (validates draft DNA against schema + Registry System; hard stop on failure)
 ▼
Generation Engine  ◄────────────────────────────────────────┐
 │  (orchestrator — invokes producer engines below in order) │
 │                                                            │
 ├──► DNA System        (source of truth, read by every producer engine)
 ├──► Registry System   (agentTypes/, modules/ discovery, read by every producer engine)
 │                                                            │
 ├──► Template Engine   ─┐                                    │
 ├──► Module Engine     ─┤                                    │
 ├──► Persona Engine    ─┼─ all read DNA + Registry System,   │
 ├──► Prompt Engine     ─┤  write into the in-progress         │
 ├──► Memory Engine     ─┤  project directory                  │
 ├──► Documentation Eng.─┘                                    │
 │                                                            │
 ▼                                                            │
Deployment Engine (OPTIONAL — only runs if dna.deployment.target is set;   │
 │  skipped entirely, no-op, for every project that doesn't opt in)         │
 │  resolves deployments/<target>, scaffolds deployment/ directory content  │
 ▼                                                            │
Interface Engine (OPTIONAL — only runs if dna.interface.type is set;      │
 │  skipped entirely, no-op, for every project that doesn't opt in)         │
 │  resolves interfaces/<type>, scaffolds interface/ directory content      │
 ▼                                                            │
Packaging Engine ──────────────────────────────────────────────┘
 │  (finalizes: standalone check, atomic move to outputDir)
 ▼
Generated Project  (standalone — no KhedraX dependency, per Constitution #14;
                     if deployment/ or interface/ was scaffolded, its scripts
                     and application code are fully self-contained and
                     require no further KhedraX invocation to run)
```

Key structural rule: **DNA System and Registry System have no upstream
dependencies within KhedraX.** Everything else depends on them; they depend
on nothing but the filesystem/schema they own. This is what lets new
producer engines (a future `Voice Engine`, say) plug in without touching
DNA or Registry.

Producer engines (Template, Module, Persona, Prompt, Memory, Documentation)
are siblings, not a chain — the Generation Engine invokes them in a fixed
order (Template → Module → Persona → Prompt → Memory → Documentation)
because later ones consume earlier ones' output, but none of them call each
other directly. All inter-engine communication passes through the Generation
Engine.

---

## 3. Ownership Matrix

### CLI
- **Owns:** argument parsing, user-facing command surface, exit codes, help text
- **Reads:** `process.argv`, environment (Node version check), interactive prompts
- **Writes:** nothing to disk directly — constructs a draft `AgentDNA` and hands it to the Workflow Engine
- **Never:** validates business rules beyond input shape; contains agent-type or module-specific logic; writes generated files

### Workflow Engine
- **Owns:** step sequencing, checkpoint file lifecycle, resume/retry logic
- **Reads:** the ordered `WorkflowStep[]`, checkpoint files at `~/.khedrax/checkpoints/{buildId}.json`
- **Writes:** checkpoint files and step-completion state
- **Never:** knows what any individual step does internally; contains DNA, Registry, or template logic

### Validation Engine
- **Owns:** DNA schema validation, DNA-vs-Registry cross-checks (does the requested type/module/persona/backend exist), duplicate-module detection, a pre-flight exclusive-prompt-section conflict check (Work Package #8 — shares its conflict-detection logic with Prompt Engine's own generation-time check, rather than duplicating it), spec-safety scoring
- **Reads:** draft `AgentDNA`, Registry System's available agentTypes/modules/personas/memoryBackends, including each module's declared prompt-fragment section/exclusivity metadata
- **Writes:** a validation report (errors/warnings), stored as a workflow artifact — never touches the generated project
- **Never:** generates files, mutates DNA, executes any module or template code

### Generation Engine
- **Owns:** orchestration order of the producer engines, the atomic generation transaction (write to temp dir, commit on success)
- **Reads:** validated `AgentDNA`, Registry System, and the output of each producer engine it invokes
- **Writes:** the generated project directory (via Packaging Engine's atomic commit)
- **Never:** parses CLI args; contains template-rendering, module-resolution, or persona logic itself; calls an LLM; executes the generated agent

### DNA System
- **Owns:** the `AgentDNA` schema, defaults, and merge logic (agentType presets + CLI overrides + resume-from-checkpoint)
- **Reads:** `agent.yaml` on load/resume, CLI-provided overrides
- **Writes:** the final `agent.yaml` into the generated project (as the canonical spec artifact)
- **Never:** knows about template files, module implementations, or how generation mechanically happens

### Registry System
- **Owns:** discovery and indexing of `agentTypes/`, `modules/` (each module's descriptor now also carries its declared prompt-fragment `section`/`exclusive` metadata, as of Work Package #8 — read from that module's `prompts/fragment.meta.json` using the same shared default-filling logic Prompt Engine uses, never duplicated), `personas/` (Work Package #2), and `memoryBackends/` (Work Package #6) from the filesystem — and, as of Work Package #11, from any number of additional external **plugin roots**, each shaped exactly like a (partial) copy of the built-in registry layout
- **Reads:** those filesystem directories (built-in and plugin), each entry's own metadata file (`agentType.json`, `module.json`, `persona.json`, `backend.json`, and now each module's `prompts/fragment.meta.json`)
- **Writes:** nothing — read-only index, optionally cached in memory per run
- **Never:** validates DNA content itself (that's Validation Engine); renders anything; encodes meaning about what a type or module "does"; silently lets a plugin-supplied entry override a built-in one of the same name — a collision is always resolved in the built-in's favor, with a logged warning, never a silent shadow

### Template Engine
- **Owns:** variable substitution and rendering of base-scaffold template files into concrete output files
- **Reads:** `templates/agent-base/`, the fields of `AgentDNA` needed for substitution
- **Writes:** rendered scaffold files into the in-progress (temp) project directory
- **Never:** decides which modules are included; contains persona or prompt logic; talks to the CLI or Registry directly (goes through Generation Engine)

### Module Engine
- **Owns:** resolving `AgentDNA.modules` against the Registry System and merging each selected module's `implementation/`, `configuration/`, `prompts/`, `tests/` into the project
- **Reads:** `module.json` and each module's subdirectories, `AgentDNA.modules`
- **Writes:** module-derived files into the in-progress project directory
- **Never:** decides the module set (that's DNA's job, set before this engine runs); executes any module's runtime code; contains persona logic

### Persona Engine
- **Owns:** resolving a persona preset (if referenced), deriving constraints, mapping module-declared capabilities into agent-readable descriptions, and producing the final `BehavioralProfile`
- **Reads:** `AgentDNA.persona`, the Registry System's `personas/` snapshot, Module Engine's resolved-modules artifact (for capability/constraint contributions)
- **Writes:** the `BehavioralProfile` artifact, consumed by Prompt Engine and Documentation Engine — not written directly to the project itself
- **Never:** writes final prompt files; decides module composition; talks to the CLI; contradicts or overrides a module's declared capabilities

### Prompt Engine
- **Owns:** composing the final prompt output as named, ordered layers (identity, constraints, capabilities, instructions, escalation) from Persona Engine's `BehavioralProfile` plus each selected module's `prompts/` fragment and optional fragment metadata; resolving same-section conflicts between modules deterministically
- **Reads:** Persona Engine's `BehavioralProfile` artifact, Module Engine's resolved prompt fragments and their optional `fragment.meta.json`, `AgentDNA`
- **Writes:** the `prompts/` directory in the generated project
- **Never:** talks to the CLI; decides personas or module set itself; calls any LLM; silently drops one of two modules that both claim exclusive ownership of the same section — that must fail loudly, per the same principle Module Engine uses for colliding file paths

### Memory Engine
- **Owns:** resolving a memory backend (from `AgentDNA.memory.backend` or a default) against the Registry System's `memoryBackends/` snapshot, merging `AgentDNA.memory.config` overrides onto that backend's declared defaults, cross-referencing resolved modules' `requiresMemory` declarations, and scaffolding the `memory/` directory and configuration accordingly
- **Reads:** `AgentDNA.memory`, the Registry System's `memoryBackends/` snapshot, Module Engine's resolved-modules artifact (for `requiresMemory` declarations)
- **Writes:** the `memory/` directory and its configuration in the generated project
- **Never:** implements actual runtime memory storage logic beyond scaffold/config; executes memory calls; decides the module set or persona

### Documentation Engine
- **Owns:** generating `README.md` and `docs/` describing the assembled agent
- **Reads:** final `AgentDNA`, resolved modules, Persona Engine output
- **Writes:** `README.md` and `docs/` in the generated project
- **Never:** alters DNA or any other engine's output; makes decisions that affect the generated agent's behavior

### Packaging Engine
- **Owns:** final-assembly guarantees — enforcing Constitution #14 (no KhedraX runtime dependency anywhere in output), generating a dependency manifest for the generated project, atomically committing the temp directory to `outputDir`
- **Reads:** the fully-assembled temp project directory, final `AgentDNA`, Module Engine's resolved module descriptors (for the manifest), and the KhedraX installation root path (to detect leaked build-time absolute paths — the one case where Packaging Engine needs to know anything about KhedraX's own location, purely to guarantee the generated output contains no trace of it)
- **Writes:** `PACKAGE_MANIFEST.json` into the temp directory (as part of the packaging step, before the atomic commit), then the final generated project directory (or archive) at `outputDir`
- **Never:** renders templates, resolves modules, or invokes Persona/Prompt/Memory/Documentation engines itself — it only verifies and commits their combined output

### Deployment Engine (Work Package #13 — not a producer, see §1/§2)
- **Owns:** resolving a requested deployment target (`dna.deployment.target`) against the Registry System's `deployments/` snapshot, and scaffolding a self-contained `deployment/` directory (environment templates, a deploy script, secrets placeholders, monitoring/rollback documentation) into the generated project
- **Reads:** `dna.deployment`, the Registry System's `deployments/` snapshot
- **Writes:** the `deployment/` directory in the in-progress project, before Packaging Engine's atomic commit
- **Never:** executes any deployment, network, wallet, or infrastructure action itself; requires network access at generation time; produces a scaffolded deploy script that depends on KhedraX being invoked again to run (Constitution #14 — the script must be fully independent); runs at all when `dna.deployment.target` is unset (a no-op for every project that doesn't opt in)

### Interface Engine (Work Package #16 — not a producer, see §1/§2)
- **Owns:** resolving a requested interface type (`dna.interface.type`) against the Registry System's `interfaces/` snapshot, and scaffolding a self-contained `interface/` directory (a working application skeleton — static chat UI, bot client, or admin dashboard — for the user to configure and run independently) into the generated project
- **Reads:** `dna.interface`, the Registry System's `interfaces/` snapshot
- **Writes:** the `interface/` directory in the in-progress project, before Packaging Engine's atomic commit
- **Never:** executes, installs dependencies for, or runs any interface code itself at generation time; requires network access at generation time; runs at all when `dna.interface.type` is unset (a no-op for every project that doesn't opt in). Note the one deliberate asymmetry with Deployment Engine: the *templates* Interface Engine copies are allowed to contain real application logic (an actual bot client, an actual fetch call in client-side JS) since that code is the generated project's own future runtime behavior — but `interfaceEngine.ts` itself, the TypeScript that does the copying and rendering, is held to the exact same "never execute anything" standard as every other engine.

---

## 4. Why this ordering matters

With Constitution v1.0 and this Architecture Overview both frozen, Work
Package #1 can now be scoped as: **DNA System + Registry System + Workflow
Engine + Generation Engine (orchestrating Template Engine + Module Engine,
with Persona/Prompt/Memory/Documentation/Packaging present as pass-through
stubs matching their defined interfaces)**. Nothing in that scope requires a
future redesign — later work packages deepen individual engines in place.
