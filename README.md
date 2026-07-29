# KhedraX

**KhedraX is a documentation-first AI agent generation platform.** It
generates complete, production-ready, standalone AI agent projects from
structured specifications — the same way its sister project,
Hydra_Genesix, generates complete decentralized exchange projects.

```
khedrax create MyAgent --type customer-support --modules memory,billing-subscription
```

...produces a full, independent project you can hand to someone with zero
KhedraX installed on their machine, and it still works.

---

## What KhedraX is not

- Not an AI assistant, not an agent framework, not a hosted service.
- KhedraX itself never executes, deploys, or runs anything on your
  behalf. It generates software. What that software does once you run it
  is entirely up to you — see [Constitution](./KHEDRAX_CONSTITUTION.md)
  principles #14 and #15, which are load-bearing, not aspirational.

## Quick Start

```bash
# See what's available
khedrax create --help

# Generate an agent
khedrax create SupportBot --type customer-support --modules memory

# Generate with a persona override, a deployment target, and an interface
khedrax create SupportBot \
  --type customer-support \
  --modules memory,billing-subscription,auth-google \
  --persona friendly-assistant \
  --deployment pharos \
  --interface admin
```

The generated project lands at `./SupportBot/` (or wherever `--output`
points). Open it — it's a complete, self-contained folder: `agent.yaml`,
`README.md`, `docs/`, `prompts/`, `memory/`, `deployment/`, `interface/`,
plus namespaced subfolders for every module you selected. Nothing in that
folder references KhedraX. You could delete KhedraX entirely and the
generated project is unaffected.

## Running a generated agent in isolation

A generated project needs nothing from KhedraX to be inspected, edited, or
built on:

```bash
cd SupportBot
cat agent.yaml           # the single source of truth for this agent's spec
cat docs/README.md       # full persona, constraints, and per-module capability breakdown
cat prompts/README.md    # the composed system prompt
```

If you generated with `--deployment <target>`, the project owns a real
`deployment/` directory with `deploy.sh`, `status.sh`, `logs.sh`,
`rollback.sh`, `destroy.sh`, and `update.sh` — each a genuine, if
scaffold-only, script. You can run any of them directly:

```bash
cd SupportBot
./deployment/deploy.sh   # KhedraX doesn't need to be involved at all
```

`khedrax deploy <path>` / `status` / `logs` / `rollback` / `destroy` /
`update` are pure conveniences — each one does nothing but locate and run
the project's own script. KhedraX contains zero deployment logic itself;
it never calls an RPC, never touches a wallet, never makes a network
request on your behalf. If you generated with `--interface <type>`, the
`interface/` directory is similarly a real, working starting point (a
Discord bot skeleton, a web chat client, an admin dashboard) that you
configure with your own credentials and run yourself.

## How the pieces fit together

KhedraX's whole growth strategy is **"grow registries, not engines."**
Almost everything you can select — agent types, personas, modules,
memory backends, deployment targets, interface types — is a directory of
plain JSON/Markdown files, not code. Adding a new one never requires
touching KhedraX's own source.

### Registries (the "what you can choose from")

| Registry | Selects... | Example entries |
|---|---|---|
| `agentTypes/` | A named preset bundling defaults | `customer-support`, `research`, `discord-moderator` |
| `modules/` | Composable capabilities | `memory`, `discord`, `github`, `rag`, `billing-*` (8), `auth-*` (7) |
| `personas/` | Tone, traits, constraints, escalation policy | `professional-support`, `friendly-assistant` |
| `memoryBackends/` | How the agent's memory is configured | `in-memory`, `redis` |
| `deployments/` | Where/how the agent can be deployed | `pharos`, `ethereum`, `base`, `local` |
| `interfaces/` | How a human talks to the agent | `web`, `discord`, `telegram`, `admin` |

A generated agent is a **composition** of one entry from each relevant
registry, not a monolithic template. Two agents with the same `agentType`
can look completely different depending on which modules, persona, and
deployment target were selected.

### Engines (the "how it gets built")

Every registry choice is resolved and rendered by an engine. Six
**producer engines** always run, in a fixed order, for every generation:
`Template → Module → Persona → Prompt → Memory → Documentation`. Two more
— **Deployment Engine** and **Interface Engine** — run conditionally,
only when you ask for a deployment target or an interface, and are never
part of that fixed order (this distinction is what lets KhedraX keep
adding real new capability without ever needing an incompatible version
bump — see [`VERSIONING_POLICY.md`](./VERSIONING_POLICY.md)). Every
engine follows the same rule: it only ever *writes files*. None of them —
not one, anywhere in this codebase — executes code, calls a network
endpoint, or spawns a process during generation. The one narrow exception
is the CLI's deployment launcher itself, and even that only ever runs a
script the generated project already owns.

### Billing and authentication are just modules

There's no `BillingEngine` or `AuthEngine`. Eight billing models
(`billing-free` through `billing-hybrid`) and seven auth providers
(`auth-email` through `auth-sso`) are modules — selected the exact same
way `memory` or `discord` are, composed the exact same way, documented the
exact same way. This is deliberate: see
[`ENGINE_DECISION_HIERARCHY.md`](./ENGINE_DECISION_HIERARCHY.md) for the
reasoning behind treating a domain as data before ever reaching for a new
engine.

### Plugins — extending KhedraX without touching KhedraX

Every registry can also be extended from *outside* the KhedraX repo:

```bash
khedrax create MyAgent --type basic --modules my-custom-module \
  --plugin-path ./my-plugin-directory
```

A plugin root is just a directory shaped like a (partial) copy of the
built-in registry layout. Built-in entries always win a name collision;
plugin roots are scanned in the order given, with every collision logged,
never silently swallowed.

## Governing documents (read these for anything this README doesn't cover)

- [`KHEDRAX_CONSTITUTION.md`](./KHEDRAX_CONSTITUTION.md) — the 15
  non-negotiable architectural principles every work package is checked
  against.
- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) — the full engine
  map, dependency graph, and ownership matrix (who reads what, writes
  what, and must never touch what).
- [`VERSIONING_POLICY.md`](./VERSIONING_POLICY.md) — what counts as a
  safe v1.x change versus a breaking v2.0 change, and why.
- [`ENGINE_DECISION_HIERARCHY.md`](./ENGINE_DECISION_HIERARCHY.md) — the
  mandatory review process before any new engine is even proposed, plus
  standing decisions already made about specific future capabilities
  (including what's explicitly *out* of scope, like a live marketplace).
- [`CHANGELOG.md`](./CHANGELOG.md) — every architecture version bump,
  what changed, and which work package caused it.
- [`docs/PORTFOLIO_CAPABILITY_MATRIX.md`](./docs/PORTFOLIO_CAPABILITY_MATRIX.md),
  [`docs/DOGFOOD_CAPABILITY_MATRIX.md`](./docs/DOGFOOD_CAPABILITY_MATRIX.md),
  [`docs/BILLING_MODELS.md`](./docs/BILLING_MODELS.md),
  [`docs/AUTH_PROVIDERS.md`](./docs/AUTH_PROVIDERS.md),
  [`docs/WP19_ADMIN_DASHBOARD.md`](./docs/WP19_ADMIN_DASHBOARD.md) —
  reference tables for what's actually in each registry today.
- [`PLUGIN_AUTHORING_GUIDE.md`](./PLUGIN_AUTHORING_GUIDE.md) — how to
  build and install a third-party plugin.

## Current status

KhedraX is at architecture v1.9. Nineteen work packages have shipped:
the full generation pipeline, real persona/prompt/memory/documentation
engines, an eight-agent production portfolio and a five-tool dogfood
portfolio, a plugin ecosystem, deployment registry + CLI, an interface
engine, and billing/auth as composable modules — every one of them
independently verified against real generated output, not just reported
test results. See `CHANGELOG.md` for the full history.

