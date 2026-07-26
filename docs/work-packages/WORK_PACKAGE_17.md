# KhedraX Work Package #17
### Billing & Monetization — eight billing models as modules
### (pure registry growth, zero engine changes)

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.6, `SYSTEM_ARCHITECTURE.md`
v1.6, `VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`,
`WORK_PACKAGE_04.md` (the module-expansion pattern this package repeats
exactly). **Targets: Architecture v1.6 — no bump required.** Per
`ENGINE_DECISION_HIERARCHY.md`'s standing disposition, this decomposes
entirely into Levels 1, 2, and 3 — no new engine, no new DNA field, no new
registry category beyond `modules/`, which already exists.

This prompt is implementation-ready. Do not make architectural decisions.

**This should be the simplest package since Work Package #10/#12: the
target is zero changed files under `src/`, exactly like every prior pure
module-growth package.** If you find yourself wanting to add a
`billingEngine.ts`, a new `dna.billing` field, or a new `billingModels/`
registry category, stop — that's scope creep this package's own governing
document explicitly warns against. Billing models are modules, selected
via the existing `--modules` flag, exactly like `memory`/`discord`/`github`.

---

## 1. Engineering Objective

Add eight new modules — `billing-free`, `billing-subscription`,
`billing-usage`, `billing-credit`, `billing-token`, `billing-nft`,
`billing-enterprise`, `billing-hybrid` — each following the exact
established module shape (`module.json`, `implementation/`,
`configuration/`, `prompts/`, `tests/`). Two of them additionally include
an invoice/receipt template file inside `implementation/` (a plain
additive file within a directory Module Engine already copies wholesale
— no Module Engine change needed).

## 2. Why This Exists

Every prior "new domain" temptation in this project (deployment, then
interfaces) turned out to need real, careful new-engine work. Billing is
the test of the opposite instinct: proving that not everything needs a
new engine, and that the module system built in Work Package #1 and
proven at scale in Work Package #4/#10/#12 is *still* the right tool for
a domain that looks, at first glance, complicated enough to deserve its
own machinery. Pricing config and wallet-routing data live on each
module's own `configuration/default.json` — the same place `memory`'s
backend config or a `deployments/<target>/deployment.json`'s config
fields already live. Documentation Engine already renders every module's
capabilities/constraints generically — it needs no changes to describe
billing modules any differently than it describes `discord` or `github`.

## 3. Architecture Boundaries

- No file under `src/` should need to change. This is the primary
  acceptance criterion, exactly as it was for Work Package #10 and #12.
- No new DNA field, no new registry category, no CLI flag beyond the
  already-existing `--modules`.
- "Wallet routing config" is just data on a module's
  `configuration/default.json` — it does not tie into Deployment Engine
  or Interface Engine in any way. These are unrelated concerns that
  happen to both mention "wallet" as a word; do not attempt to connect
  a billing module's config to `dna.deployment`'s wallet fields.
- Revenue dashboards are explicitly deferred, not part of this package —
  a future deepening of Interface Engine's `admin` template could
  eventually read billing module data, but building that now would be
  scope creep into a different engine's territory.

## 4. Worked Example 1: `billing-subscription` (with invoice template)

**`modules/billing-subscription/module.json`:**
```json
{
  "name": "billing-subscription",
  "version": "1.0.0",
  "requiresMemory": true,
  "capabilities": [
    "Manage recurring subscription billing and plan tiers.",
    "Handle plan upgrades and downgrades."
  ],
  "constraints": [
    "Never charge a payment method without the user's prior consent.",
    "Always provide a clear cancellation path."
  ]
}
```
`configuration/default.json`: `{ "billingCycle": "monthly", "tiers": ["basic", "pro", "enterprise"], "gracePeriodDays": 3 }`
`prompts/fragment.md`: `This module provides subscription billing scaffolding: recurring charges, plan tier management, and upgrade/downgrade handling.`
`prompts/fragment.meta.json`: `{ "section": "instructions", "priority": 0, "exclusive": false }`
`implementation/README.md`: same "v1 scaffold — configuration and prompt fragment only; no runtime implementation yet" wording as every prior module (not "placeholder").
`implementation/invoice-template.md` (new, additive — Module Engine already copies everything under `implementation/` wholesale, so this needs no engine change):
```markdown
# Invoice

**Billing period:** {{periodStart}} – {{periodEnd}}
**Plan:** {{planName}}
**Amount due:** {{amount}}

This is a static invoice template scaffold. Wire it to real billing data
in your own implementation.
```

## 5. Worked Example 2: `billing-token` (with wallet routing config)

**`modules/billing-token/module.json`:**
```json
{
  "name": "billing-token",
  "version": "1.0.0",
  "capabilities": [
    "Bill using a fungible token on a configured blockchain network."
  ],
  "constraints": [
    "Never move tokens without an explicit, user-authorized transaction.",
    "Always surface the exact token amount and network fee before a charge."
  ]
}
```
`configuration/default.json`: `{ "walletRoutingRequired": true, "tokenSymbolPlaceholder": "TOKEN", "networkPlaceholder": "example-network" }`
`prompts/fragment.md`: `This module provides token-based billing scaffolding: charging a configured fungible token on a blockchain network.`
Same `fragment.meta.json` and README wording pattern as every other module. No invoice template for this one — an on-chain transaction is its own receipt; note this explicitly in `implementation/README.md` rather than fabricating a template that wouldn't reflect anything real.

## 6. Remaining Six Modules (same file shape as §4/§5 — follow the pattern, not a special case)

| Module | requiresMemory | Capabilities | Constraints | Invoice template? |
|---|---|---|---|---|
| `billing-free` | no | "Operate without charging the end user." | "Never introduce a paid feature without explicit agent-type configuration to do so." | No |
| `billing-usage` | yes | "Meter and bill based on measured usage volume." | "Never bill for usage that wasn't actually metered and logged."; "Always make current usage and running cost visible to the user." | Yes — usage-summary template (period, metered units, rate, total) |
| `billing-credit` | yes | "Manage a prepaid credit balance and deduct usage from it." | "Never let a balance go negative without explicit overdraft configuration."; "Always notify the user before their balance is exhausted." | Yes — balance-summary receipt template |
| `billing-nft` | no | "Gate access or features based on NFT ownership." | "Never assume NFT ownership without verifying it on-chain."; "Never mint or transfer an NFT without explicit user authorization." | No (on-chain ownership is its own record) |
| `billing-enterprise` | yes | "Support custom contract terms and invoiced billing cycles." | "Never deviate from a signed contract's agreed terms without renegotiation."; "Always route enterprise billing questions to a human account manager." | Yes — enterprise invoice template (contract reference, billing cycle, amount) |
| `billing-hybrid` | yes | "Combine two or more billing models (e.g. subscription plus usage overage) for a single agent." | "Never apply two billing models' charges for the same unit of usage — avoid double-billing."; "Always clearly itemize which charges came from which billing model." | Yes — itemized combined-charges template |

`billing-free`'s and `billing-nft`'s `configuration/default.json` can be
minimal (`{}` or a single descriptive field) — not every module needs rich
config, matching the precedent that sparse modules are fine (Constitution
#9's "empty but valid" principle applies to module config too).

## 7. Required Tests

1. One test per module (8 total, or grouped efficiently in a new
   `tests/unit/billingModules.test.ts`) generating via `createAgent()`
   with `--type basic --modules billing-<name>` and asserting: `agent.yaml`
   lists the module; `docs/README.md` shows its capabilities/constraints;
   `prompts/README.md` includes its fragment.
2. A multi-billing-module composition test: generate with `--modules
   billing-usage,billing-hybrid,memory` together and confirm no collisions,
   correct alphabetical ordering, no cross-contamination — same
   composition-at-scale proof Work Package #4/#10 established.
3. Confirm the two invoice-template files (`billing-subscription`,
   `billing-usage`, `billing-credit`, `billing-enterprise`, `billing-hybrid`
   — five of the eight) actually appear in the generated project's
   `implementation/<module>/` directory with their real content, not just
   that generation succeeds.

## 8. Deliverables

1. Eight new modules under `modules/` (§4–§6).
2. `tests/unit/billingModules.test.ts` (§7).
3. `docs/BILLING_MODELS.md` (new, repo root `docs/`) — a short reference
   table: model name, one-line description, requiresMemory, has invoice
   template — mirroring `docs/PORTFOLIO_CAPABILITY_MATRIX.md`'s style.
4. A `CHANGELOG.md` entry (v1.6 → v1.7) following the established format
   exactly, with the byte-level formatting check from this file's history
   verified before reporting done.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --modules billing-subscription --force`
   succeeds; paste the actual `implementation/billing-subscription/invoice-template.md`
   content from the real generated output (not the source template).
2. `khedrax create Y --type basic --modules billing-usage,billing-hybrid,memory --force`
   succeeds with all three composed correctly — paste `docs/README.md`'s
   Modules section showing all three, alphabetically ordered.
3. **Zero files under `src/` were modified.** Confirm with a diff against
   the pre-package state showing no output — this is the primary proof
   this package's stated objective held.
4. `npm test` and `npm run typecheck` both pass — paste raw terminal
   output directly.
5. `docs/BILLING_MODELS.md` exists and matches §6's table.
6. `CHANGELOG.md`'s v1.7 entry is present and byte-level clean — paste the
   `head -c 1 CHANGELOG.md | od -An -tx1` and leading-whitespace check
   output, not just a visual read.
7. Commit locally; push is fine per the established practice, state
   clearly whether you did.
