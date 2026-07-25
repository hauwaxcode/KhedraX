# KhedraX Work Package #16
### Interface Engine — web, Discord, Telegram, and admin dashboard
### scaffolding (admin dashboard is WP19 on the roadmap; this is its
### architectural implementation)

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.5, `SYSTEM_ARCHITECTURE.md`
v1.5 (Interface Engine sections added for this package),
`VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`, `WORK_PACKAGE_13.md`
(the conditional-call pattern this package repeats). **Targets: Architecture
v1.6** — a new engine, but classified v1.x per `ENGINE_DECISION_HIERARCHY.md`'s
Level 5 approval and `VERSIONING_POLICY.md` §2's conditional-call carve-out.

This prompt is implementation-ready. Do not make architectural decisions.

This is the second engine added since the original 13-engine map — follow
Deployment Engine's (Work Package #13) precedent exactly: a conditional
call inside `GenerationEngine.run()`, never added to the `producers` array.

---

## 1. Engineering Objective

Add an `interfaces/` registry (`web`, `discord`, `telegram`, `admin` —
four types) and a new Interface Engine that, when `dna.interface.type` is
set, resolves the matching descriptor and scaffolds a self-contained
`interface/` directory into the generated project: a real, working
application skeleton (not a placeholder) the user configures with their
own credentials and runs independently.

## 2. Why This Exists

Every engine so far generates configuration, documentation, or prompts —
nothing yet gives a generated agent an actual way for a human to talk to
it. This closes that gap: a web chat UI, a Discord/Telegram bot client, or
an admin dashboard, all scaffolded the same way everything else in this
system is — as real starting-point code, not a fake promise of one.

## 3. The Constitutional Boundary — read this section before writing any code

This package has a narrower, more precise boundary than Work Package
#13/14/15's deployment scaffolds, and getting the distinction right matters
more here than anywhere else so far.

**`interfaceEngine.ts` itself — KhedraX's own code that does the
copying/rendering — must never execute, fetch, spawn, or make a network
call. This is identical to every other engine's rule, no exception.**

**The *templates* it copies are different from Deployment Engine's
templates, and are allowed to contain real, functional application code.**
A Discord bot skeleton legitimately has `const client = new
Client(...)` and `client.login(process.env.DISCORD_BOT_TOKEN)` in its own
file — that's the generated project's own future runtime behavior, the
same way a generated `package.json` legitimately lists real npm
dependencies without KhedraX installing them. A web interface's
client-side JavaScript legitimately has a real `fetch()` call to a local
API endpoint — that code runs in the end user's browser once *they* run
the project, never during `khedrax create`.

**What must never happen, regardless of which side of this boundary
you're on:** nothing in this package causes `npm install`, a real
network request, or any process execution during generation itself. The
test for whether something belongs in a template versus needing extra
care: "does this code run when a human later runs the generated project,
or does it run right now while KhedraX is generating it?" Only the first
is acceptable, and only within template files, never within
`interfaceEngine.ts`.

**Safety grep for this package is scoped narrower than Work Package
#13/14/15's:** run it only against `interfaceEngine.ts` itself, **not**
against `interfaces/*/templates/*` — the templates are expected to contain
`fetch`, client library calls, and similar real application code, and
grepping them the same way Deployment Engine's inert scripts were grepped
would incorrectly flag legitimate, intended content.

## 4. Architecture Boundaries

- No producer engine, Validation Engine, Deployment Engine, or Generation
  Engine's existing behavior changes. Interface Engine is invoked in
  `generationEngine.ts` the same way Deployment Engine already is —
  conditionally, after the producer loop, before Packaging Engine. Both
  conditional engines run independently of each other (a project can have
  a deployment target, an interface, both, or neither).
- `dna.interface` mirrors `dna.deployment`'s exact shape:
  `{ type?: string; config?: Record<string, unknown> }` — additive,
  consistent naming convention across every optional DNA section that
  resolves against a registry.
- Admin dashboard is **not** a fifth engine. It is `interfaces/admin/`,
  one more entry in the same registry, scaffolded by the exact same
  Interface Engine code path as `web`/`discord`/`telegram`. Per
  `ENGINE_DECISION_HIERARCHY.md`'s standing disposition, this satisfies
  WP19 on the roadmap architecturally, even though WP19 remains its own
  roadmap entry describing the user-facing deliverable.
- If a selected interface type conventionally pairs with a specific module
  (e.g. `discord` interface pairs naturally with the `discord` module),
  do not hard-require it — emit a validation **warning** if the module
  isn't also selected (mirrors the existing memory-required-module warning
  pattern from Work Package #1/#6), never a hard error. Composition stays
  flexible per Constitution #13.

## 5. Files to Create / Modify

```
khedrax/interfaces/
├── web/
│   ├── interface.json
│   └── templates/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── discord/
│   ├── interface.json
│   └── templates/
│       └── bot.js
├── telegram/
│   ├── interface.json
│   └── templates/
│       └── bot.js
└── admin/
    ├── interface.json
    └── templates/
        └── index.html

khedrax/src/registry/types.ts             (MODIFY: InterfaceDescriptor,
                                            RegistrySnapshot.interfaces)
khedrax/src/registry/interfaceRegistry.ts (NEW: mirrors deploymentRegistry.ts)
khedrax/src/registry/index.ts             (MODIFY: include interfaces)

khedrax/src/dna/schema.ts   (MODIFY: AgentDNA.interface, CreateAgentOptions.interface)
khedrax/src/dna/loader.ts   (MODIFY: seed dna.interface.type from options.interface)

khedrax/src/validation/validateDna.ts  (MODIFY: unknown interface type → error;
                                         interface/module pairing → warning)

khedrax/src/engines/interfaceEngine.ts (NEW: mirrors deploymentEngine.ts's
                                         non-producer wiring pattern)

khedrax/src/generation/generationEngine.ts (MODIFY: conditional call to
                                             InterfaceEngine, alongside the
                                             existing Deployment Engine call)

khedrax/src/cli/bin/khedrax.ts       (MODIFY: --interface <type> flag)
khedrax/src/cli/commands/create.ts   (MODIFY: thread interface option through)

khedrax/tests/unit/interfaceEngine.test.ts    (NEW)
khedrax/tests/unit/interfaceRegistry.test.ts  (NEW)
```

## 6. Registry Data

**`interfaces/discord/interface.json`:**
```json
{
  "name": "discord",
  "version": "1.0.0",
  "description": "A Discord bot client scaffold using discord.js.",
  "pairsWithModule": "discord"
}
```

**`interfaces/telegram/interface.json`:** same shape, `"pairsWithModule": null` (no existing `telegram` module — leave unpaired rather than inventing one just for this).

**`interfaces/web/interface.json`:** same shape, `"pairsWithModule": null`.

**`interfaces/admin/interface.json`:** same shape, `"pairsWithModule": null`.

## 7. Template Content (real, functional skeletons — not inert placeholders)

**`interfaces/discord/templates/bot.js`:**
```javascript
// Discord bot skeleton generated by KhedraX.
// Set DISCORD_BOT_TOKEN in your environment before running.
// npm install discord.js (not installed automatically — this is a starting point).
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  // TODO: connect this to the agent's own prompt/memory logic.
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

**`interfaces/web/templates/app.js`:**
```javascript
// Web chat interface skeleton generated by KhedraX.
// Expects a local API endpoint at /api/chat — implement that endpoint
// yourself using the agent's own prompts/memory/module configuration.
async function sendMessage(text) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });
  return response.json();
}
// TODO: wire this up to your chosen frontend framework or vanilla DOM code.
```

**`interfaces/admin/templates/index.html`:** a static HTML shell whose body
is rendered at generation time with the agent's own already-known data —
name, type, persona tone, module list — the same kind of data
Documentation Engine already renders, just as an HTML dashboard shell
instead of markdown. No live data (billing, deployment status) — those
don't exist as generated artifacts yet, and this package must not
fabricate them.

Fill in `telegram/templates/bot.js` and `web/templates/{index.html,style.css}`
following the same "real skeleton, clearly TODO'd where user input is
required" pattern.

## 8. Required Tests

1. `interfaceRegistry.test.ts`: discovers all four built-in types; skips a
   malformed `interface.json` (same established pattern as every other
   registry).
2. `interfaceEngine.test.ts`: generating with `--interface discord`
   produces `interface/bot.js` containing the real skeleton content (not
   empty, not a placeholder string); generating with no `--interface` flag
   produces no `interface/` directory at all (no-op case); admin
   dashboard's `index.html` correctly reflects the actual agent
   name/persona/modules from a real DNA object, not hardcoded sample data.
3. A DNA with `interface.type: 'discord'` but no `discord` module selected
   produces the expected validation warning, not an error, and generation
   still succeeds.
4. Safety grep, scoped correctly per §3: `interfaceEngine.ts` must be
   clean of exec/spawn/fetch/http/network calls. Do not run this same grep
   against the template files — confirm this scoping explicitly in the
   test/verification output rather than silently narrowing it.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --interface discord --force` produces a
   real `interface/bot.js` — paste its actual content.
2. `khedrax create Y --type basic --interface admin --force` produces
   `interface/index.html` with the real agent name/type/persona/modules
   embedded — paste it.
3. The interface/module pairing warning (§8 item 3) fires correctly and
   doesn't block generation.
4. `npm test` and `npm run typecheck` both pass — paste raw output.
5. The safety grep passes clean for `interfaceEngine.ts`, confirmed to be
   the correctly-scoped check (not run against templates) — paste the
   exact command used and its output.
6. Zero changes to any producer engine, Deployment Engine, Validation
   Engine's existing checks, or the fixed producer order — confirm by
   diffing `src/engines/` (other than the new `interfaceEngine.ts`),
   `src/generation/` (only the one conditional-call addition should
   appear), `src/persona/`, `src/prompt/`, `src/dna/` (only additive
   `interface` field) against the pre-package state.
7. Add the `CHANGELOG.md` entry for this package (v1.5 → v1.6) and bump
   `SYSTEM_ARCHITECTURE.md`/`KHEDRAX_CONSTITUTION.md`'s version headers
   together, per `VERSIONING_POLICY.md` §4 — verify the byte-level
   formatting check on `CHANGELOG.md` given its history in this project,
   and confirm what the current version actually is before incrementing
   rather than assuming.
8. Commit locally; push is fine per the user's own standing instruction,
   but state clearly whether you pushed.
