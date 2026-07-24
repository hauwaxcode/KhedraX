# KhedraX Work Package #15
### Deployment CLI — deploy, status, logs, rollback, destroy, update

Governing documents: `KHEDRAX_CONSTITUTION.md`, `SYSTEM_ARCHITECTURE.md`,
`VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`, `WORK_PACKAGE_13.md`,
`WORK_PACKAGE_14.md`. **Targets: Architecture v1.x — no version bump.**
Per `ENGINE_DECISION_HIERARCHY.md`'s standing disposition, this is Level 4
(deepening Deployment Engine to render more scripts) plus new, thin CLI
commands — no new engine.

This prompt is implementation-ready. Do not make architectural decisions.

---

## 1. Engineering Objective

Add six new CLI commands — `khedrax deploy`, `status`, `logs`, `rollback`,
`destroy`, `update` — each taking a path to an already-generated project
and doing exactly one thing: locate that project's own
`deployment/<action>.sh` script and run it, streaming its output through
and exiting with its exit code. Extend Deployment Engine to scaffold these
additional per-action scripts (beyond the existing `deploy.sh`) from
target templates, the same way `deploy.sh` already works.

## 2. Why This Exists — and the one constitutional distinction that matters most in this package

Every other engine in this system, and every file `deploymentEngine.ts`
itself writes, must never call `exec`/`spawn`/`fetch`/any network or
process API — verified by grep in both Work Package #13 and #14's review.
**That rule does not change here.** But `khedrax deploy` itself is a
different kind of code: its entire job is to launch a process. This is
deliberate and was explicitly decided before this package was scoped
("Thin launcher only — KhedraX never executes deployment logic itself").
The distinction that makes this safe, and that must not be blurred:

- The CLI command **never** contains deployment logic itself — it doesn't
  know what Pharos, Ethereum, or any target actually requires, doesn't
  read any registry, doesn't touch DNA. It only locates and runs a file
  that **already exists** at a fixed, predictable path inside an
  **already-generated, standalone project**
  (`<projectPath>/deployment/<action>.sh`).
- It never fetches, downloads, or constructs that script — the script
  must already be a real file on disk, written by `createAgent()` at
  generation time. If it isn't there, the command errors clearly; it does
  not fall back to some other behavior.
- This means the generated project remains fully standalone
  (Constitution #14) — a user could `cd` into it and run
  `./deployment/deploy.sh` directly, with KhedraX never invoked again.
  `khedrax deploy` is a convenience for exactly that, nothing more.

The safety grep rule from Work Package #13/#14 (`no exec/spawn/fetch/http`)
still applies, unchanged, to `deploymentEngine.ts` and every
`deployments/*/templates/*` file. It does **not** apply to the new CLI
command files in this package — those files' whole purpose is to spawn
exactly one process, the generated project's own script, nothing else.

## 3. Architecture Boundaries

- No new engine. Deployment Engine's ownership boundary
  (`SYSTEM_ARCHITECTURE.md` §3) is unchanged: it still only scaffolds
  files into a generated project, never executes anything. This package
  only widens *how many* scripts it scaffolds, using the exact same
  render logic already proven for `deploy.sh`.
- The six new CLI commands share one implementation
  (`runDeploymentScript(action, projectPath)`), not six near-duplicate
  command handlers — this is the same DRY discipline as every other part
  of this system (e.g. `detectExclusiveConflicts` being shared rather than
  reimplemented per Work Package #8).
- These commands take zero registry/DNA/generation-context input. They
  operate purely on the filesystem layout of an already-generated project.
  If an implementation reaches for `getRegistrySnapshot` or `AgentDNA`
  anywhere in these command files, that's a sign of scope creep — stop and
  reconsider.
- No `--dry-run`, no passthrough args, no `.env` auto-loading in the CLI
  itself. If a script needs environment setup, that's the script's own
  concern (owned by the generated project), not something the launcher
  does on its behalf. Keep the launcher exactly as thin as its name says.

## 4. Files to Modify / Create

```
khedrax/src/cli/deploymentLauncher.ts   (NEW: shared runDeploymentScript())
khedrax/src/cli/bin/khedrax.ts          (MODIFY: register the six new subcommands)

khedrax/src/engines/deploymentEngine.ts (MODIFY: render additional per-action
                                          scripts from templates, same pattern
                                          as deploy.sh)

khedrax/deployments/pharos/templates/   (NEW: status.sh, logs.sh, rollback.sh,
                                          destroy.sh, update.sh)
khedrax/deployments/local/templates/    (NEW: status.sh, logs.sh, rollback.sh,
                                          destroy.sh, update.sh)
khedrax/deployments/ethereum/templates/ (NEW: same five)
khedrax/deployments/base/templates/     (NEW: same five)

khedrax/tests/unit/deploymentLauncher.test.ts  (NEW)
khedrax/tests/unit/deploymentEngine.test.ts     (EXTEND: new scripts render)
```

## 5. `runDeploymentScript` (implement exactly, do not redesign)

```typescript
// src/cli/deploymentLauncher.ts
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function runDeploymentScript(action: string, projectPath: string): Promise<number> {
  const scriptPath = path.join(projectPath, 'deployment', `${action}.sh`);
  try {
    await fs.access(scriptPath);
  } catch {
    console.error(
      `No deployment/${action}.sh found in ${projectPath}. ` +
      `This project may not have been generated with a --deployment target, ` +
      `or its target does not provide a script for '${action}'.`
    );
    return 1;
  }
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath], { cwd: projectPath, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error(`Failed to run ${scriptPath}: ${err.message}`);
      resolve(1);
    });
  });
}
```

Each of the six CLI commands (`deploy`/`status`/`logs`/`rollback`/
`destroy`/`update`) is a thin registration that parses `<projectPath>`
from argv and calls `runDeploymentScript('<action>', projectPath)`, then
`process.exit()`s with the returned code. No other logic belongs in the
command handlers themselves.

## 6. Deployment Engine Extension

Generalize the existing `deploy.sh`-specific rendering into a loop over
`['deploy', 'status', 'logs', 'rollback', 'destroy', 'update']`: for each
action, if `deployments/<target>/templates/<action>.sh` exists, copy and
render it exactly the way `deploy.sh` is rendered today (same
`hasExistingSecretsCheck` detection, same `secretsComment` insertion, same
shebang handling) into `deployment/<action>.sh` in the generated project.
If a target doesn't provide a template for a given action, skip it
silently — do not render a fallback/generic script for anything except
`deploy` (which already has that fallback from Work Package #13; the other
five actions have no equivalent fallback — a missing script means the
target genuinely doesn't support that action yet, and the CLI's own clear
error message in §5 handles that case correctly).

## 7. New Script Templates

Same inert, scaffold-only style as `deploy.sh` — echo statements and
`# TODO` comments, no real logic, matching every prior module/deployment
template's established wording pattern. Example for `pharos`:

**`deployments/pharos/templates/status.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "Status check scaffold for Pharos deployment."
# TODO: replace with your agent's actual status/health check logic
```

**`deployments/pharos/templates/destroy.sh`:**
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "Destroy scaffold for Pharos deployment."
echo "Rollback strategy on record: redeploy-previous-version"
# TODO: replace with your agent's actual teardown logic
```

Follow the same shape for `logs.sh`, `rollback.sh`, `update.sh`, and for
all four targets (`pharos`, `ethereum`, `base`, `local`) — `local`'s
versions can be even simpler (matching its existing minimal `deploy.sh`).

## 8. Required Tests

1. `deploymentLauncher.test.ts`: script exists and exits 0 → resolves 0;
   script exists and exits 1 → resolves 1; script doesn't exist → resolves
   1 with the clear error message (assert the message, not just the code);
   confirm the working directory passed to the spawned process is
   `projectPath` (e.g. via a test script that writes its own `pwd` output
   somewhere checkable).
2. `deploymentEngine.test.ts` additions: generating with `--deployment
   pharos` produces `deploy.sh`, `status.sh`, `logs.sh`, `rollback.sh`,
   `destroy.sh`, and `update.sh` in the output; a target missing one of
   the five new templates (test with a synthetic fixture target that only
   provides `deploy.sh`) produces only `deploy.sh`, no empty/broken files
   for the missing ones.
3. Re-run Work Package #13/#14's exact safety grep against
   `deploymentEngine.ts` and every `deployments/*/templates/*` file — must
   still be clean. Separately, confirm the new
   `deploymentLauncher.ts`/`bin/khedrax.ts` changes **do** contain
   `spawn` — this is expected and correct there, unlike everywhere else.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --deployment pharos --force` followed by
   `khedrax status <path-to-X>`, `khedrax logs <path-to-X>`, etc. for all
   six actions — paste real terminal output for at least `deploy` and
   `destroy`.
2. Running `khedrax status <path-to-a-project-with-no-deployment-dir>`
   produces the clear error message and exit code 1, not a crash.
3. The safety grep from §8 item 3 passes clean for every generator-side
   file, and confirms `spawn` is present (correctly) in the launcher.
4. `npm test` and `npm run typecheck` both pass — paste raw output.
5. Zero changes to `src/registry/`, `src/validation/`, `src/dna/`,
   `src/generation/`, `src/persona/`, `src/prompt/`, or any engine other
   than `deploymentEngine.ts` — confirm by diffing against the pre-package
   state.
6. git Commit and git push and update the repo 

