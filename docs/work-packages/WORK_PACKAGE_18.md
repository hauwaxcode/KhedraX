# KhedraX Work Package #18
### Authentication — seven auth providers as modules
### (pure registry growth, zero engine changes)

Governing documents: `KHEDRAX_CONSTITUTION.md` v1.7, `SYSTEM_ARCHITECTURE.md`
v1.7, `VERSIONING_POLICY.md`, `ENGINE_DECISION_HIERARCHY.md`,
`WORK_PACKAGE_17.md` (the exact pattern this package repeats — same
shape, different domain). **Targets: Architecture v1.7 — no bump
required.** Per `ENGINE_DECISION_HIERARCHY.md`'s standing disposition:
"same shape as Billing: providers are Level 1 registry entries, generated
auth code is a Level 4 Module Engine category. No new engine."

This prompt is implementation-ready. Do not make architectural decisions.

**Same target as Work Package #17: zero changed files under `src/`.** If
this package starts looking like it needs an `authEngine.ts` or a new
`dna.auth` field, stop — auth providers are modules, selected via the
existing `--modules` flag, exactly like billing models were in Work
Package #17 and `discord`/`github` were in Work Package #4.

---

## 1. Engineering Objective

Add seven new modules — `auth-email`, `auth-google`, `auth-github`,
`auth-discord`, `auth-telegram`, `auth-siwe`, `auth-sso` — each following
the exact established module shape. No new file-type convention beyond
what already exists; unlike Work Package #17's invoice templates, auth
providers don't need an extra scaffold-file category — the standard
`module.json` + `implementation/` + `configuration/` + `prompts/` +
`tests/` shape is sufficient.

## 2. Why This Exists

Same proof as Work Package #17, different domain: authentication looks
like it might deserve special machinery (OAuth flows, token handling,
wallet signature verification), but every one of those concerns is either
descriptive configuration data (client ID env var names, redirect URI
placeholders, a nonce TTL) or a capability/constraint pair Persona Engine
and Documentation Engine already know how to compose and render generically.

## 3. Architecture Boundaries

- No file under `src/` should need to change — same primary acceptance
  criterion as Work Package #17.
- No new DNA field, no new registry category, no new CLI flag.
- **`requiresMemory` does not apply to any of these modules.** That flag
  represents a need for the agent's own conversational memory (the
  `memory` module's domain), not session/token persistence for an auth
  provider — those are a different concern. Do not set `requiresMemory:
  true` on any auth module just because it involves "state"; if a real
  future need for cross-referencing arises, it would need its own
  mechanism, not an overloaded reuse of this flag.
- Every module's configuration is placeholder-only — env var *names*
  where secrets would go (e.g. `GOOGLE_CLIENT_ID`), never real values or
  any code that actually calls an OAuth provider, verifies a signature, or
  validates a token. Same scaffold-only discipline as every prior module.

## 4. Worked Example 1: `auth-google` (OAuth-shaped provider)

**`modules/auth-google/module.json`:**
```json
{
  "name": "auth-google",
  "version": "1.0.0",
  "capabilities": [
    "Authenticate users via Google OAuth.",
    "Retrieve basic profile information (name, email) upon consent."
  ],
  "constraints": [
    "Never request more OAuth scopes than the agent actually needs.",
    "Never store the user's Google credentials directly — only the issued token."
  ]
}
```
`configuration/default.json`: `{ "clientIdEnvVar": "GOOGLE_CLIENT_ID", "clientSecretEnvVar": "GOOGLE_CLIENT_SECRET", "redirectUriPlaceholder": "https://your-app.example/auth/google/callback" }`
`prompts/fragment.md`: `This module provides Google OAuth authentication scaffolding: sign-in, consent, and basic profile retrieval.`
`prompts/fragment.meta.json`: `{ "section": "instructions", "priority": 0, "exclusive": false }`
`implementation/README.md`: same "v1 scaffold — configuration and prompt fragment only; no runtime implementation yet" wording as every prior module.

## 5. Worked Example 2: `auth-siwe` (wallet-signature-shaped provider)

**`modules/auth-siwe/module.json`:**
```json
{
  "name": "auth-siwe",
  "version": "1.0.0",
  "capabilities": [
    "Authenticate users via Sign-In With Ethereum (EIP-4361).",
    "Verify a signed message against the claimed wallet address."
  ],
  "constraints": [
    "Never accept a signature without verifying it against the exact expected message and nonce.",
    "Never treat wallet ownership alone as proof of any off-chain identity claim."
  ]
}
```
`configuration/default.json`: `{ "network": "ethereum", "nonceTtlSeconds": 300 }`
`prompts/fragment.md`: `This module provides Sign-In With Ethereum authentication scaffolding: nonce issuance and signed-message verification.`
Same `fragment.meta.json` and README wording pattern as every other module.

## 6. Remaining Five Modules (same file shape — follow the pattern, not a special case)

| Module | Capabilities | Constraints | Config shape |
|---|---|---|---|
| `auth-email` | "Authenticate users via email and password."; "Support password reset via email verification link." | "Never store a password in plaintext."; "Never send a password reset link to an unverified email address." | `{ "passwordResetTokenTtlMinutes": 60, "requireEmailVerification": true }` |
| `auth-github` | "Authenticate users via GitHub OAuth."; "Optionally retrieve the user's public repository access for authorization decisions." | "Never request organization-wide GitHub permissions unless explicitly required."; "Never store the user's GitHub credentials directly — only the issued token." | `{ "clientIdEnvVar": "GITHUB_CLIENT_ID", "clientSecretEnvVar": "GITHUB_CLIENT_SECRET" }` |
| `auth-discord` | "Authenticate users via Discord OAuth."; "Verify server membership or role for authorization decisions." | "Never request more Discord OAuth scopes than the agent actually needs."; "Never store the user's Discord credentials directly — only the issued token." | `{ "clientIdEnvVar": "DISCORD_CLIENT_ID", "clientSecretEnvVar": "DISCORD_CLIENT_SECRET" }` |
| `auth-telegram` | "Authenticate users via Telegram Login Widget."; "Verify the authenticity of Telegram login data using the bot token hash check." | "Never accept Telegram login data without verifying its hash signature."; "Never store the user's Telegram credentials directly." | `{ "botTokenEnvVar": "TELEGRAM_BOT_TOKEN" }` |
| `auth-sso` | "Authenticate users via a configured enterprise SSO provider (SAML/OIDC)."; "Support just-in-time user provisioning on first login." | "Never bypass the configured SSO provider's own session/token validation."; "Always route SSO configuration issues to a human administrator rather than guessing." | `{ "protocol": "saml", "metadataUrlEnvVar": "SSO_METADATA_URL" }` |

Note: this module intentionally does **not** pair with any existing
Interface Engine or Deployment Engine data — auth is orthogonal to both,
same as billing was. Do not attempt to cross-wire them.

## 7. Required Tests

1. One test per module (7 total, in a new `tests/unit/authModules.test.ts`)
   generating via `createAgent()` with `--type basic --modules auth-<name>`
   and asserting: `agent.yaml` lists the module; `docs/README.md` shows its
   capabilities/constraints; `prompts/README.md` includes its fragment.
2. A multi-auth-module composition test: generate with `--modules
   auth-google,auth-github,auth-siwe` together (three different provider
   shapes — OAuth, OAuth, wallet-signature) and confirm no collisions,
   correct alphabetical ordering, no cross-contamination.
3. A mixed composition test combining an auth module with a billing
   module and `memory` (e.g. `auth-google,billing-subscription,memory`) —
   proving Work Package #17 and #18's additions compose cleanly together,
   not just within their own domain.

## 8. Deliverables

1. Seven new modules under `modules/` (§4–§6).
2. `tests/unit/authModules.test.ts` (§7).
3. `docs/AUTH_PROVIDERS.md` (new, repo root `docs/`) — same reference-table
   style as `docs/BILLING_MODELS.md`: provider name, one-line description,
   config shape summary.
4. A `CHANGELOG.md` entry (v1.7 → v1.8), byte-level formatting verified
   before reporting done.

## 9. Acceptance Criteria

1. `khedrax create X --type basic --modules auth-siwe --force` succeeds;
   paste the real generated `implementation/auth-siwe/` directory listing
   and its `README.md` content.
2. `khedrax create Y --type basic --modules auth-google,auth-github,auth-siwe --force`
   succeeds with all three composed correctly — paste `docs/README.md`'s
   Modules section.
3. `khedrax create Z --type basic --modules auth-google,billing-subscription,memory --force`
   (the cross-domain composition from §7 item 3) succeeds — paste its
   `docs/README.md` Modules section too, proving Work Package #17 and #18
   compose together without issue.
4. **Zero files under `src/` were modified** — confirm with a diff against
   the pre-package state showing no output.
5. `npm test` and `npm run typecheck` both pass — paste raw output.
6. `docs/AUTH_PROVIDERS.md` exists and matches §6's table.
7. `CHANGELOG.md`'s v1.8 entry is present and byte-level clean — paste the
   verification command output, not just a visual read.
8. Commit locally; state clearly whether you also pushed.
