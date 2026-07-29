import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAgent } from '../../src/cli/commands/create.ts';
import { addModule } from '../../src/cli/addModule.ts';
import fsSync from 'node:fs';

test('add-module installs a module and updates the generated project files', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-add-module-'));
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'ModuleBot',
    type: 'basic',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
  });

  await addModule(outputDir, 'faq-support', path.resolve('.'));

  const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  assert.match(agentYaml, /modules:\n  - memory\n  - faq-support/);

  const promptReadme = await fs.readFile(path.join(outputDir, 'prompts', 'README.md'), 'utf8');
  assert.match(promptReadme, /curated FAQ/);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /### faq-support/);

  const faqContent = await fs.readFile(path.join(outputDir, 'implementation', 'faq-support', 'faq.md'), 'utf8');
  assert.match(faqContent, /## How do I create an account\?/);
});

test('add-module rejects an already-present module', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-add-module-existing-'));
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'ModuleBot',
    type: 'basic',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
  });

  await assert.rejects(() => addModule(outputDir, 'memory', path.resolve('.')), /already installed/);
});

test('add-module rejects exclusive conflicts and leaves the project untouched', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-add-module-conflict-'));
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'ModuleBot',
    type: 'basic',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
  });

  const moduleDir = path.join(outputDir, 'modules', 'temp-conflict');
  await fs.mkdir(moduleDir, { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'module.json'), JSON.stringify({ name: 'temp-conflict', version: '1.0.0', capabilities: ['Conflicts.'], constraints: [] }));
  await fs.mkdir(path.join(moduleDir, 'prompts'), { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'prompts', 'fragment.meta.json'), JSON.stringify({ section: 'instructions', exclusive: true }));
  await fs.writeFile(path.join(moduleDir, 'prompts', 'fragment.md'), 'Temp conflict fragment.');

  const beforeReadme = await fs.readFile(path.join(outputDir, 'README.md'), 'utf8');
  const beforeAgent = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  const beforePromptDir = await fs.readdir(path.join(outputDir, 'prompts'));

  const conflictRoot = path.join(workspace, 'registry');
  await fs.mkdir(path.join(conflictRoot, 'modules', 'memory'), { recursive: true });
  await fs.copyFile(path.join(path.resolve('.'), 'khedrax', 'modules', 'memory', 'module.json'), path.join(conflictRoot, 'modules', 'memory', 'module.json'));
  await fs.mkdir(path.join(conflictRoot, 'modules', 'memory', 'prompts'), { recursive: true });
  await fs.writeFile(path.join(conflictRoot, 'modules', 'memory', 'prompts', 'fragment.meta.json'), JSON.stringify({ section: 'instructions', exclusive: true }));
  await fs.writeFile(path.join(conflictRoot, 'modules', 'memory', 'prompts', 'fragment.md'), 'Memory conflict fragment.');
  await fs.mkdir(path.join(conflictRoot, 'modules', 'temp-conflict'), { recursive: true });
  await fs.copyFile(path.join(moduleDir, 'module.json'), path.join(conflictRoot, 'modules', 'temp-conflict', 'module.json'));
  await fs.mkdir(path.join(conflictRoot, 'modules', 'temp-conflict', 'prompts'), { recursive: true });
  await fs.copyFile(path.join(moduleDir, 'prompts', 'fragment.meta.json'), path.join(conflictRoot, 'modules', 'temp-conflict', 'prompts', 'fragment.meta.json'));
  await fs.copyFile(path.join(moduleDir, 'prompts', 'fragment.md'), path.join(conflictRoot, 'modules', 'temp-conflict', 'prompts', 'fragment.md'));

  await assert.rejects(() => addModule(outputDir, 'temp-conflict', conflictRoot), /Prompt composition conflict/);

  const afterReadme = await fs.readFile(path.join(outputDir, 'README.md'), 'utf8');
  const afterAgent = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  const afterPromptDir = await fs.readdir(path.join(outputDir, 'prompts'));

  assert.equal(afterReadme, beforeReadme);
  assert.equal(afterAgent, beforeAgent);
  assert.deepEqual(afterPromptDir.sort(), beforePromptDir.sort());
});

test('add-module composes successive compatible additions', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'khedrax-add-module-compose-'));
  const outputDir = path.join(workspace, 'out');

  await createAgent({
    name: 'ModuleBot',
    type: 'basic',
    outputDir,
    modules: ['memory'],
    force: true,
    verbose: false,
  });

  await addModule(outputDir, 'faq-support', path.resolve('.'));
  await addModule(outputDir, 'onboarding-flow', path.resolve('.'));

  const agentYaml = await fs.readFile(path.join(outputDir, 'agent.yaml'), 'utf8');
  assert.match(agentYaml, /modules:\n  - memory\n  - faq-support\n  - onboarding-flow/);

  const docsReadme = await fs.readFile(path.join(outputDir, 'docs', 'README.md'), 'utf8');
  assert.match(docsReadme, /### faq-support/);
  assert.match(docsReadme, /### onboarding-flow/);
});
