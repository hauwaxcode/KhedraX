# Skill Packs

Skill packs are ordinary registry modules whose implementation content carries real domain knowledge instead of placeholder scaffolding. They are a good fit for FAQ content, onboarding playbooks, incident runbooks, and other durable operational knowledge that a generated agent can consume after the initial scaffold exists.

## Example skill-pack modules

- faq-support — a curated FAQ for common support questions.
- onboarding-flow — a step-by-step onboarding checklist for new users.
- incident-runbook — a concise incident-response checklist for operators.

## Post-generation module addition

Use the add-module command to enrich an already-generated project with a module from the registry without regenerating the whole project from scratch.

```bash
khedrax add-module <projectPath> <moduleName>
```

The command checks the existing project before writing anything:

- it requires an existing agent.yaml in the target project;
- it rejects a module that is already installed;
- it reuses the shared duplicate-module and exclusive-prompt-section checks before copying any files;
- it updates the project’s agent.yaml modules list plus the generated prompts/README.md and docs/README.md content;
- it does not modify unrelated files such as deployment/, interface/, or memory/ content.
