# KhedraX Architectural Constitution
### v1.7

This document is the single source of truth for KhedraX engineering decisions.
Every implementation prompt, PR, and generated artifact must comply with it.
If a future decision conflicts with this document, the document wins — change
the document deliberately, don't drift around it silently.

Sister-project precedent: this constitution plays the same role for KhedraX
that `Hydra_Genesix_drifts_alignment.md` and `.github/copilot-instructions.md`
play for Hydra_Genesix. Where Hydra learned a lesson the hard way, KhedraX
should encode it here from day one instead of relearning it in v2.

---

## 1. Documentation is architecture

The spec (`agent.yaml`, backed by `AgentDNA`) is not an input to the system —
it **is** the system's architecture. Generated code is an implementation of
that architecture, never the architecture itself. Generation is a pure
function of DNA + templates. If a feature can't be expressed as a change to
the DNA schema or a new template, it doesn't belong in KhedraX yet.

## 2. The CLI contains no business logic

The CLI's only job is: parse args → validate → construct an `AgentDNA` object
→ hand it to the Generation Engine. No agent-type-specific branching, no
module-specific logic, no template logic lives in `src/cli/`. If you find
yourself writing an `if (agentType === 'research')` in the CLI, that logic
belongs in a template or engine, not here.

## 3. Nothing is hardcoded that can be data

Agent types, modules, personas, prompt templates, tool definitions, memory
backends, and workflow templates are all discovered from the filesystem
(`agentTypes/`, `modules/`) or loaded from config — never enumerated as
TypeScript union types or switch statements. The engine layer must be able to
generate an agent type it has never seen in source code, as long as a
conforming directory exists. Adding a capability to KhedraX should mean
"add a folder," not "recompile the core."

## 4. DNA is the single source of truth

`AgentDNA` is the one object every engine consumes. Engines do not accept
ad hoc config objects. If an engine needs new input, that input is added as a
new (optional, so it stays backward-compatible) section of the DNA schema —
never as a side-channel parameter.

## 5. Engines are generic and data-driven

Persona Engine, Prompt Engine, Memory Engine, Tool Engine, and Documentation
Engine all read DNA + templates/modules and emit files. None of them contain
knowledge of any specific agent, persona, or module — that knowledge lives in
the templates and module definitions they read.

## 6. Generation is deterministic

The same `AgentDNA` + the same template/module versions must always produce
byte-identical output. No timestamps, random IDs, or environment-dependent
values inside generated project files unless explicitly part of the DNA
(e.g., `buildId`).

## 7. Every module is self-contained and uniform

A module is a directory with exactly: `module.json` (metadata + schema),
`implementation/`, `configuration/`, `prompts/`, `tests/`. The engine treats
all modules identically regardless of what they do — a `memory` module and a
`discord` module are structurally indistinguishable to the loader.

## 8. Pipelines are steps, and steps are resumable

Work is a sequence of `WorkflowStep` functions run by a generic runner with
checkpointing (mirrors Hydra's `~/.hydra/checkpoints/` pattern, here
`~/.khedrax/checkpoints/`). A step is a pure function of
`(checkpoint) => Promise<StepResult>`. No step reaches into another step's
internals. Any pipeline must survive being killed mid-run and resumed.

## 9. Schemas are additive, never breaking

`agent.yaml` sections may start empty but the top-level shape (`name`,
`description`, `agent`, `persona`, `modules`, `memory`, `tools`, `workflows`,
`deployment`, `testing`) is fixed from v1. New fields are added as optional
sub-fields of existing sections. A KhedraX v1 project must still validate
against the v3 schema.

## 10. No placeholders, no stubs, ever

Matches Hydra's own release checklist: no `TODO`, no `PLACEHOLDER`, no stub
functions in committed code or generated output. If a feature isn't ready,
it's absent from the DNA schema, not present-and-fake.

## 11. Build the core before the capability

Each work package is small, self-contained, and production-quality on its
own. The Generation Engine and DNA schema are built and hardened before any
specific engine (Persona, Prompt, Memory, Tool, Documentation) is written.
No work package should require a future, unwritten work package to function
correctly at its own scope.

## 12. GitHub Copilot is the engineer, not the architect

Every implementation prompt handed to Copilot must be fully implementation-
ready: objective, rationale, folder structure, interfaces, inputs/outputs,
validation rules, edge cases, acceptance criteria. Copilot should never need
to make an architectural decision — only an implementation one.

## 13. Composition over specialization

An agent is assembled from reusable modules, never implemented as a unique,
one-off project. Agent types are simply predefined collections of modules
plus configuration:

```
CustomerSupport = Memory + Knowledge + Ticketing + Email + Prompt + Documentation
```

No engine may contain logic specific to a named agent type. The generator
always composes; it never specializes.

## 14. Every generated project is independent

Once generation completes, the output is a fully standalone project. It must
not import, require, or otherwise depend on KhedraX at runtime. Generated
agents are portable, editable, deployable, and maintainable entirely on
their own. KhedraX generates software — it does not host software.

## 15. KhedraX generates software, not intelligence

KhedraX's responsibility ends at producing a complete, production-ready
project. It does not make runtime decisions, execute autonomous reasoning,
or provide hosted inference. Generation is KhedraX's job; execution is the
generated project's job. This boundary is never blurred.
