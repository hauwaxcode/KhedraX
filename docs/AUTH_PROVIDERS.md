# Authentication Providers

| Provider | Description | Config shape summary |
|---|---|---|
| auth-email | Authenticates users via email and password and supports password reset via email verification link. | `passwordResetTokenTtlMinutes`, `requireEmailVerification` |
| auth-google | Authenticates users via Google OAuth and can retrieve basic profile information upon consent. | `clientIdEnvVar`, `clientSecretEnvVar`, `redirectUriPlaceholder` |
| auth-github | Authenticates users via GitHub OAuth and can optionally retrieve public repository access. | `clientIdEnvVar`, `clientSecretEnvVar` |
| auth-discord | Authenticates users via Discord OAuth and can verify server membership or role for authorization decisions. | `clientIdEnvVar`, `clientSecretEnvVar` |
| auth-telegram | Authenticates users via the Telegram Login Widget and verifies login data with a bot-token hash check. | `botTokenEnvVar` |
| auth-siwe | Authenticates users via Sign-In With Ethereum and verifies a signed message against a claimed wallet address. | `network`, `nonceTtlSeconds` |
| auth-sso | Authenticates users via an enterprise SAML/OIDC SSO provider and supports first-login provisioning. | `protocol`, `metadataUrlEnvVar` |
