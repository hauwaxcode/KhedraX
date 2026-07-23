# KhedraX Work Package #14
### Runtime Adapters — richer deployment descriptors, consolidated
### into the existing `deployments/` registry (no new registry category)

Governing documents: `KHEDRAX_CONSTITUTION.md`, `SYSTEM_ARCHITECTURE.md`,
`VERSIONING_POLICY.md`, `WORK_PACKAGE_13.md`. **Targets: Architecture
v1.x — no version bump required.** This deepens Deployment Engine's
existing implementation and enriches the existing `deployments/` registry
— it does not add a new registry category, does not change Deployment
Engine's ownership boundary, and does not touch the producer order.

This prompt is implementation-ready. Do not make architectural decisions.

---

## 1. Engineering Objective

Enrich `deployments/<target>/deployment.json`'s schema with wallet,
RPC, secrets-description, environment-template, verification-strategy,
and config-template data — all **additive** fields, none replacing an
existing field's shape. Deepen `DeploymentEngine` to render this richer
data into the scaffolded `deployment/` directory (a new `config.yaml`,
richer `.env.example` and `README.md` content). Add two new deployment
targets (`ethereum`, `base`) using the enriched schema, and enrich the
existing `pharos` target with it, proving the schema works across
multiple targets in one package, the same way every prior registry-growth
package (Work Package #4, #10, #12) proved growth with more than one new
entry.

## 2. Why This Exists

Work Package #13 taught KhedraX *that* a deployment target exists and
scaffolds a self-contained script. This package teaches it *how to talk
to* that target — supported wallet types, RPC endpoint shape, what each
required secret is actually for, non-secret environment configuration,
and how a human would verify a deployment succeeded. None of this is new
architecture; it's richer data flowing through the same engine.

## 3. Architecture Boundaries — read carefully, this package has two hard constraints

**A. One directory per target — no parallel registry.** Everything lives
under `deployments/<target>/`. Do not create a `runtimeAdapters/`
directory or any second top-level registry that also has per-target
subfolders. This was an explicit design correction from the original
proposal specifically to avoid two independent sources of truth for the
same target's wallet/RPC/secrets data — the exact class of bug Work
Package #13's review caught in `deploymentEngine.ts` (a regenerated
secrets-check competing with the template's own hand-written one). One
target, one directory, one descriptor file, enriched.

**B. `secretsRequired` stays exactly `string[]` — do not change its
shape.** `deploymentEngine.ts`'s existing, already-verified rendering
code depends on `secretsRequired.join(' ')` and
`.map((secret) => ...)` treating each entry as a bare string. Changing it
to an array of objects would silently break that code (producing
`[object Object]` in rendered scripts). Add a **separate**, new, optional
field for descriptions instead — `secretsDescriptions?: Record<string,
string>` (secret name → human-readable description) — that existing code
ignores entirely and new code consults only when present, falling back
gracefully when it isn't.

**C. Nothing renders as, or performs, a live check.** `verificationStrategy`
is descriptive text for a human to read and act on manually — never code
that calls a real RPC endpoint, checks a real health URL, or executes
anything. This is the single most likely place for this package to
accidentally cross Constitution #14/#15, precisely because "verification"
and "health endpoint" sound like they want live code. They don't get any
here. If you find yourself writing a `fetch()`, `http.get()`, or any
network call anywhere in `deploymentEngine.ts` or a rendered template,
stop — that's the violation this boundary exists to prevent.

**D. Additive schema only.** Every new field on `DeploymentDescriptor`
is optional. A target descriptor from Work Package #13 with none of these
new fields must still generate correctly with its old, simpler output —
confirm this by re-running the existing `local` target (which should stay
untouched and minimal) and confirming its output is identical to before.

## 4. Files to Modify

```
khedrax/deployments/pharos/deployment.json   (MODIFY: add new optional fields)
khedrax/deployments/ethereum/                (NEW: full target, same shape as pharos)
khedrax/deployments/base/                    (NEW: full target, same shape as pharos)
khedrax/deployments/local/                   (UNCHANGED — do not touch; this is the
                                               regression proof that old, simpler
                                               descriptors still work)

khedrax/src/registry/types.ts                (MODIFY: DeploymentDescriptor gains
                                               the new optional fields — additive)
khedrax/src/engines/deploymentEngine.ts      (MODIFY: render the new fields into
                                               config.yaml, richer .env.example/README;
                                               existing secretsRequired-based logic
                                               must not change)

khedrax/tests/unit/deploymentEngine.test.ts  (EXTEND)
```

## 5. Data Shape — enriched `deployment.json`

**`deployments/pharos/deployment.json`** (enriched — additive fields only,
everything from Work Package #13 stays exactly as it was):
```json
{
  "name": "pharos",
  "version": "1.1.0",
  "runtime": "node18",
  "network": {
    "chainId": "pharos-1",
    "rpcUrlEnvVar": "PHAROS_RPC_URL",
    "exampleRpcEndpoint": "https://rpc.pharos.example/v1"
  },
  "walletIntegration": {
    "type": "keystore",
    "supportedTypes": ["keystore", "hardware"],
    "secretEnvVar": "PHAROS_DEPLOYER_PRIVATE_KEY"
  },
  "secretsRequired": ["PHAROS_RPC_URL", "PHAROS_DEPLOYER_PRIVATE_KEY"],
  "secretsDescriptions": {
    "PHAROS_RPC_URL": "RPC endpoint used to submit transactions to the Pharos network.",
    "PHAROS_DEPLOYER_PRIVATE_KEY": "Private key for the wallet that pays deployment gas and owns the deployed agent."
  },
  "environmentTemplate": {
    "PHAROS_NETWORK_MODE": "mainnet"
  },
  "monitoring": { "healthCheckPath": "/health", "logDestination": "stdout" },
  "rollback": { "strategy": "redeploy-previous-version" },
  "verificationStrategy": "After running deploy.sh, manually confirm the health endpoint returns 200 and check the deployment log for a successful startup message. Do not consider the deployment verified until both checks pass.",
  "configTemplate": { "network": "pharos", "logLevel": "info" }
}
```

**`deployments/ethereum/deployment.json`** and **`deployments/base/deployment.json`**:
same shape, adjust `network.chainId`/`exampleRpcEndpoint`, env var name
prefixes (`ETHEREUM_RPC_URL`/`BASE_RPC_URL` etc.), and
`walletIntegration.supportedTypes` (add `"walletconnect"` as a third
supported type for these two, to prove the array isn't hardcoded to
exactly two entries).

## 6. Rendering Additions (deploymentEngine.ts)

- `deployment/config.yaml`: rendered from `descriptor.configTemplate` if
  present (simple key-value YAML, reuse the same YAML-rendering care from
  Work Package #1's `agent.yaml` fix — no bare `[]`/empty-value bugs);
  omit the file entirely if `configTemplate` is absent (a target that
  doesn't define one, like `local`, gets no `config.yaml` — don't render
  an empty file).
- `.env.example`: existing secrets rendering (`SECRET=`) stays exactly as
  is; additionally append `environmentTemplate` entries as
  `KEY=defaultValue` (these are non-secret, so an actual default value is
  correct here, unlike the empty-value convention for secrets).
- `README.md`: append a "Verification" section from `verificationStrategy`
  if present, and enrich the secrets list to include each secret's
  description from `secretsDescriptions` when available, falling back to
  just the bare name when a description isn't provided for that secret.

## 7. Required Tests

1. `local` target's output is byte-identical to its Work Package #13
   behavior (the additive-schema regression proof).
2. `pharos`'s enriched output includes the new `config.yaml`, the
   `environmentTemplate` entries in `.env.example` with real default
   values (not empty), and the `README.md`'s verification section and
   secret descriptions.
3. `ethereum` and `base` generate correctly with their own distinct data
   — assert their outputs differ appropriately (different chain IDs,
   different env var names), not just that they don't crash.
4. A target descriptor missing `configTemplate` entirely produces no
   `config.yaml` file (confirm its absence, not just that generation
   succeeds).
5. **Safety check, non-negotiable:** re-run the exact grep check from Work
   Package #13's review —
   `grep -rn "exec\|spawn\|fetch(\|http\.\|https\.\|child_process\|curl " khedrax/src/engines/deploymentEngine.ts khedrax/deployments/*/templates/*`
   — against every new/modified file in this package, and paste the raw
   output. Any hit beyond a bare variable-name reference (like Work
   Package #13's harmless `PHAROS_RPC_URL` match) is a failure to fix
   before this package is done.

## 8. Acceptance Criteria

1. `khedrax create X --type basic --deployment pharos --force` produces
   the enriched output — paste the real `deployment/config.yaml`,
   `.env.example`, and `README.md` content.
2. `khedrax create Y --type basic --deployment ethereum --force` and
   `--deployment base` both succeed with target-specific content — paste
   both.
3. `khedrax create Z --type basic --deployment local --force` produces
   output identical to Work Package #13's — paste it, confirming the
   regression proof.
4. The safety grep from §7 item 5 passes with no concerning hits.
5. `npm test` and `npm run typecheck` both pass — paste raw output.
6. Zero changes outside the files listed in §4 — confirm by diffing
   `src/engines/` (other than `deploymentEngine.ts`), `src/generation/`,
   `src/persona/`, `src/prompt/`, `src/dna/` against the pre-package
   state.
7. Commit locally but do not push, per the established practice from Work
   Package #13 — this keeps the state zippable for review without
   publishing before verification.
