# KhedraX Architecture Changelog

Tracks architecture version changes, per `VERSIONING_POLICY.md`. Distinct
from KhedraX's own code release history.

## v1.7 — Billing & monetization registry growth

- Work package: WP17
- Added eight new billing modules under `khedrax/modules/` with module-scaffold files only: `billing-free`, `billing-subscription`, `billing-usage`, `billing-credit`, `billing-token`, `billing-nft`, `billing-enterprise`, and `billing-hybrid`. Added module prompt fragments, configuration defaults, implementation scaffolds, tests scaffolds, and invoice/receipt-style templates for the billing models that need them. Added a billing-models reference document and regression tests covering single-module generation and multi-module composition with no engine or DNA changes.

## v1.6 — Interface Engine: web, Discord, Telegram, and admin dashboard scaffolds

- Work package: WP16
- Added a new optional Interface Engine invoked conditionally inside
  `GenerationEngine.run()` after the fixed producer loop, alongside
  Deployment Engine, with no changes to the producer order or the existing
  producer-engine ownership boundaries. Registered four built-in interface
  types under `khedrax/interfaces/` (`web`, `discord`, `telegram`, `admin`)
  and scaffolded real application skeletons into generated `interface/`
  directories, including a Discord bot client, a Telegram bot client, a web
  chat UI, and a static admin dashboard shell. Added interface DNA support
  (`dna.interface.type`/`config`), registry discovery, validation warnings
  for interface/module pairing mismatches, and CLI support via
  `--interface <type>` while keeping the engine itself free of exec/spawn/
  fetch/network calls.

## v1.5 — Deployment CLI: deploy, status, logs, rollback, destroy, update

- Work package: WP15
- Six new CLI commands, each locating an already-generated project's own
  `deployment/<action>.sh` and running it via a shared
  `runDeploymentScript()` launcher — zero registry/DNA access in the
  command handlers. Deployment Engine deepened to scaffold five additional
  per-action scripts using the same render logic already proven for
  `deploy.sh`. Fixed a bug in the shared secrets-check generator
  (`${!var}` → `${!var:-}`) that caused auto-generated scripts to crash
  with a raw bash error instead of a clean message when a required secret
  was unset. The CLI launcher is the one place in this codebase permitted
  to spawn a process — and only ever the generated project's own
  pre-existing script, never anything KhedraX constructs or fetches
  itself. No new engine.

## v1.4 — Runtime adapters: richer deployment descriptors

- Work package: WP14
- Enriched `deployments/<target>/deployment.json` with additive-only
  fields: wallet types, RPC endpoint examples, secret descriptions
  (`secretsDescriptions`, kept separate from the existing `secretsRequired`
  string array to avoid breaking its established shape), non-secret
  environment defaults, a rendered `config.yaml`, and a human-readable
  verification-strategy section. Added `ethereum` and `base` as new
  targets using the enriched schema; `local` kept unchanged as the
  regression proof that simpler, older descriptors still work. Removed an
  accidental runtime dependency on `js-yaml` from `deploymentEngine.ts` in
  favor of plain string templating, consistent with every other rendered
  file in this system. No new registry category, no new engine — this is
  Deployment Engine (Work Package #13) deepened, consolidated into the
  existing `deployments/` registry rather than a competing
  `runtimeAdapters/` tree.

## v1.3 — Deployment Registry: deployment descriptors, Deployment Engine, Pharos target

- Work package: WP13
- New `deployments/` registry (`pharos`, `local` targets) and a new
  Deployment Engine — the first new engine since the original 13-engine
  map. Classified v1.x, not v2.0, because it is invoked as a conditional
  call inside `GenerationEngine.run()` itself (after the fixed six-producer
  loop, before Packaging Engine), never added to the `producers` array —
  the fixed producer order and every existing engine's ownership boundary
  are unchanged. Deployment Engine only ever writes scaffold files
  (a deploy script the generated project owns and runs independently,
  environment templates, secrets placeholders, monitoring/rollback
  documentation) — it never executes a deployment action itself, per
  Constitution #14/#15. This conditional-call pattern is now the standing
  precedent for any future non-producer engine (see
  `ENGINE_DECISION_HIERARCHY.md`).

## v1.2 — Dogfood registry growth: generate KhedraX tooling agents

- Work package: WP12
- Added five new tooling agents to the registry, including four new agent types,
  four new personas, and a new `test-analysis` module scaffold. Generated all
  five tools via `createAgent()` in integration tests and confirmed that
  `documentation-assistant` reused existing registry entries with no new data.

## v1.1 — Plugin ecosystem: external registry directories

- Work package: WP11
- Registry System now scans, in addition to the built-in `agentTypes/`,
  `modules/`, `personas/`, and `memoryBackends/` directories, any number of
  external plugin roots supplied via repeatable `--plugin-path` flags or
  the `KHEDRAX_PLUGIN_PATH` environment variable. Built-in entries always
  take precedence on a name collision (enforced by scan order, not a
  hardcoded name list); among plugin roots, first-listed wins. Every
  collision is logged as a warning, never silently swallowed. No producer
  engine, Validation Engine, or Generation Engine required any change —
  they already consumed `RegistrySnapshot` generically. See
  `PLUGIN_AUTHORING_GUIDE.md` for the third-party authoring workflow.

## v1.0 — Locked at Work Package #9

Retroactive entry: Work Packages #1 through #9 all operated within a single
architecture version. No work package in this range required a v1.x bump
under the versioning policy's own rules, since the policy didn't exist yet
— this entry establishes v1.0 as the baseline those packages collectively
produced, effective at the versioning policy's introduction.

- **WP1** — DNA System, Registry System, Workflow Engine, Generation Engine
  (orchestrating Template Engine + Module Engine), Packaging Engine
  (minimum-viable)
- **WP1 Fix Passes** — Workflow Engine wiring, safe overwrite defaults,
  module prompt-fragment namespacing, `agent.yaml` rendering correctness
- **WP2** — Persona Engine (real implementation): persona registry,
  constraint derivation, capability mapping, behavioral profile generation
- **WP3** — Prompt Engine (real implementation): layered composition,
  conflict resolution, prompt assembly pipeline
- **WP4** — Module Engine expansion: discord, email, github, rag modules
  (data-only, zero engine changes — confirmed by review)
- **WP5** — Documentation Engine (real implementation): persona/module-aware
  root README and detailed docs/README
- **WP6** — Memory Engine (real implementation): memory backend registry,
  config resolution, module memory-requirement cross-referencing
- **WP7** — Packaging Engine (real implementation): dependency manifest,
  hardened standalone scan (leaked build-time path detection)
- **WP8** — Validation Engine: duplicate-module detection, pre-flight
  exclusive-prompt-section conflict check (shared logic with Prompt Engine)
- **WP9** — Backlog cleanup: checkpoint relocation to Workflow Engine,
  `--persona` CLI flag, js-yaml dependency verification
- **WP10** — Registry expansion: eight-agent production portfolio, six new
  agent types, seven new personas, two new modules — zero engine changes
  (confirmed by review)

**Baseline frozen:** 13 engines, the dependency graph and ownership matrix
in `SYSTEM_ARCHITECTURE.md`, and `AgentDNA`'s top-level shape, all as of
this point.

---

<!--
Future entries go above this line, most recent first. Format:

## vX.Y — <one-line description>
- Work package: WP<N>
- What changed and why
-->
