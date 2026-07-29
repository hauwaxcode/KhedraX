import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../../src/cli/commands/create.ts';

test('skill-pack modules generate real content into the output project', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-skill-packs-'));
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'SkillPackBot',
    type: 'basic',
    outputDir,
    modules: ['faq-support', 'onboarding-flow', 'incident-runbook'],
    force: true,
    verbose: false,
  });

  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptReadme, /curated FAQ/);
  assert.match(promptReadme, /structured onboarding flow/);
  assert.match(promptReadme, /incident-response checklist/);

  const implementationDir = path.join(outputDir, 'implementation', 'faq-support');
  const faqContent = await fs.readFile(path.join(implementationDir, 'faq.md'), 'utf8');
  assert.match(faqContent, /## How do I create an account\?/);
  assert.match(faqContent, /## Is my data encrypted\?/);

  const onboardingGuide = await fs.readFile(path.join(outputDir, 'implementation', 'onboarding-flow', 'guide.md'), 'utf8');
  assert.match(onboardingGuide, /1\. Confirm the user's workspace and role\./);

  const incidentChecklist = await fs.readFile(path.join(outputDir, 'implementation', 'incident-runbook', 'checklist.md'), 'utf8');
  assert.match(incidentChecklist, /- Declare the incident and capture the scope\./);
});
